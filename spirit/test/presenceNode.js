'use strict';

// spirit/test/presenceNode.js
// Presence Stage 2. The node holds the sockets, merges them, and tells
// the shell only when something actually changed.
//
// Two halves, both driven without a socket:
//   - sseClient parsing and reconnect, against a fake fetch
//   - presenceNode merging and publishing, against a fake jobs

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const sseClient = require('../run/js/sseClient');
const presenceNode = require('../run/js/presenceNode');
const relayKeys = require('../run/js/relayKeys');

// ── A NODE KNOWS ITS OWN SEATS NOW (2026-09-18) ─────────────────────
//
// These fixtures used to say "I hold a row here" by having the fake
// request return a CENSUS with this node's key in it — which is how
// ownerBadge.probe used to find out, by reading every member of every
// relay and looking for itself.
//
// A node records its seats at claim time and reads them off disk now
// (relayKeys.seat, hub.handleClaim). So a fixture says the same thing by
// writing the seat, and the fake answers the key door instead — which is
// all probe asks for: who the box is, and who runs it.
function seatEveryRelay(home, label) {
  let list = [];
  try {
    list = JSON.parse(fs.readFileSync(
      path.join(home, 'app', 'natter', 'relays.json'), 'utf8'));
  } catch (e) { list = []; }
  list.forEach(function (row) {
    if (row && row.url) relayKeys.seat(home, row.url, label || 'me');
  });
}

// What GET /api/relay/key answers. `ownerKey` is left out on purpose:
// these checks are about pinning and streams, and none of them is about
// owning the box.
function keyDoor() {
  return Promise.resolve({
    status: 200,
    text: JSON.stringify({ relayPublicKey: 'RELAYKEY', relayLabel: 'lab' }),
  });
}

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-presence-node-'));
}

// THE POST HALF, RECORDING. `createPresence` requires one, and until
// 2026-09-16 it did not: `opts.router || null` plus `&& router` on the two
// event lines meant a stream with no post half swallowed every request and
// reply in silence. Not one of the five createPresence calls in this tree's
// tests passed a router, so the seam that carries every answer home was
// asserted nowhere below liveFrontDoor.
//
// Recording rather than empty, so the tests can say what ARRIVED rather
// than only that construction succeeded.
function fakeRouter() {
  const r = { requests: [], replies: [] };
  r.onRequest = function (url, data) { r.requests.push({ url: url, data: data }); };
  r.onReply = function (data) { r.replies.push(data); };
  return r;
}

// Enough of jobs.js to be published into, and it records every update so
// the dedupe can be asserted by COUNT rather than by reading the source.
function fakeJobs() {
  const j = { updates: [], job: null };
  j.createJob = function (kind, type, data) {
    j.job = { id: 'job_1', kind: kind, type: type, data: data };
    return j.job;
  };
  j.updateJob = function (id, patch) {
    if (patch.data) Object.assign(j.job.data, patch.data);
    j.updates.push(patch);
    return j.job;
  };
  return j;
}

// -- FEEDING BYTES, WHICH IS THE ONLY WAY THE PARSER IS REACHED --------
//
//   Andy: "that should be made true for the sseClient and peerPost
//   interfaces."
//
// sseClient exported `parseChunk`, `MAX_RETRY_MS`, `IDLE_MS` and
// `FIRST_RETRY_MS`. Four exports, ZERO callers in run/ — every one existed
// because this suite read it. That is the same escape hatch as peerSearch's
// `internal` bag wearing different clothes: a module widening its surface
// for a test's convenience.
//
// `connect` is the whole interface now. Bytes go in through a fake fetch,
// events come out through onEvent, and the parser is exercised by the only
// path that ever calls it.
//
// The constants went the same way and the assertions are better for it: a
// number read out of a module proves the number, while a delay observed
// through setTimeoutImpl proves the behaviour the number was for.
function feeds(chunks, opts) {
  opts = opts || {};
  const got = [];
  let n = 0;
  const handle = sseClient.connect({
    url: 'http://relay/api/relay/stream',
    retryMs: opts.retryMs || 10,
    randomImpl: function () { return 1; },
    idleTimeoutImpl: opts.idleTimeoutImpl || function () { return 0; },
    idleClearTimeoutImpl: function () {},
    setTimeoutImpl: opts.setTimeoutImpl || function (fn) { return setTimeout(fn, 0); },
    clearTimeoutImpl: clearTimeout,
    onEvent: function (msg) { got.push(msg); },
    fetchImpl: function () {
      // PAST THE SCRIPT, THE STREAM ENDS THE WAY IT ENDED. A first draft
      // re-served the last chunk on every reconnect, so events piled up
      // across retries and a count of two became eight — a relay does not
      // repeat itself because a socket came back. A second draft went
      // QUIET instead, which broke the opposite case: a script of one
      // refusal is a relay that is DOWN, and it must keep being down or
      // the backoff has nothing to climb.
      //
      // So: content runs out into silence, a refusal runs out into more
      // refusal.
      if (n >= chunks.length && chunks[chunks.length - 1] === null) {
        n += 1;
        return Promise.reject(new Error('down'));
      }
      if (n >= chunks.length) {
        n += 1;
        return Promise.resolve({
          ok: true,
          body: { getReader: function () {
            return { read: function () { return new Promise(function () {}); } };
          } },
        });
      }
      const chunk = chunks[n];
      n += 1;
      if (chunk === null) return Promise.reject(new Error('down'));
      return Promise.resolve({
        ok: true,
        body: { getReader: function () {
          let served = false;
          return { read: function () {
            if (served) return Promise.resolve({ done: true });
            served = true;
            return Promise.resolve({ done: false, value: new TextEncoder().encode(chunk) });
          } };
        } },
      });
    },
  });
  return { events: got, close: function () { handle.close(); } };
}

test.startTest('Presence 2 — the node holds the sockets');

async function run() {
  test.subHeading('Reading the protocol, including the parts that look like nothing');

  {
    // Three frames down one stream: a heartbeat, a reply, and an event
    // whose value must survive the space after the colon. (The first frame
    // was a roster until cycle 3 removed the word; the parser never cared.)
    const fed = feeds([
      ':\n\n' +
      'event: reply\ndata: {"members":[]}\n\n' +
      'event: presence\ndata: {"key":"abc"}\n\n',
    ]);
    await new Promise(function (r) { setTimeout(r, 30); });
    fed.close();

    // THE HEARTBEAT IS NOT AN EVENT. Two frames reached onEvent, not three
    // — which is the observable form of "parseChunk answers null for a
    // lone colon", and the form that matters: a heartbeat reaching an app
    // as an event with an empty name is the bug.
    if (fed.events.length === 2) {
      test.check('a lone colon is a heartbeat and never reaches a listener');
    } else {
      test.fail('events: ' + JSON.stringify(fed.events));
    }

    const roster = fed.events[0];
    if (roster && roster.event === 'reply' && roster.data && Array.isArray(roster.data.members)) {
      test.check('an event carries its name and its parsed data');
    } else {
      test.fail('roster: ' + JSON.stringify(roster));
    }

    // The spec allows a space after the colon and most servers write one.
    // A parser that keeps it turns every key into a key with a space in
    // front, which compares unequal to itself everywhere else.
    const presence = fed.events[1];
    if (presence && presence.data && presence.data.key === 'abc') {
      test.check('and the space after the colon is not part of the value');
    } else {
      test.fail('spacing: ' + JSON.stringify(presence));
    }
  }

  test.subHeading('A stream that is cut comes back, and does not hammer');

  // A fetch that fails forever. The point is the SHAPE of the retries.
  let attempts = 0;
  const waits = [];
  const failing = sseClient.connect({
    url: 'http://relay/api/relay/stream',
    retryMs: 10,
    // RANDOM PINNED, because the delays are jittered now. Without this the
    // assertion below ("each wait is longer than the last") passes on most
    // rolls and fails on some — 10 at full spread then 20 at half spread
    // are the same number. A test that is usually right is a test nobody
    // believes on the morning it goes red.
    randomImpl: function () { return 1; },
    fetchImpl: function () { attempts += 1; return Promise.reject(new Error('down')); },
    setTimeoutImpl: function (fn, ms) { waits.push(ms); return setTimeout(fn, 0); },
    clearTimeoutImpl: clearTimeout,
      // The watchdog runs on its own clock (see sseClient), so it is
      // silenced here rather than sieved out of the backoff list.
      idleTimeoutImpl: function () { return 0; },
      idleClearTimeoutImpl: function () {},
  });
  await new Promise(function (r) { setTimeout(r, 60); });
  failing.close();

  if (attempts > 1) test.check('a refused stream is tried again — ' + attempts + ' attempts');
  else test.fail('no retry: ' + attempts);

  const growing = waits.length > 2 && waits[1] > waits[0] && waits[2] > waits[1];
  if (growing) {
    test.check('and each wait is longer than the last: ' + waits.slice(0, 3).join(', ') + 'ms');
  } else {
    test.fail('backoff did not grow: ' + waits.slice(0, 5).join(', '));
  }

  // close() has to stop the loop, not merely the current attempt — a node
  // shutting down must not leave a timer reconnecting to a relay forever.
  const settled = attempts;
  await new Promise(function (r) { setTimeout(r, 40); });
  if (attempts === settled) test.check('and close() ends it rather than the current attempt');
  else test.fail('kept retrying after close: ' + settled + ' -> ' + attempts);

  test.subHeading('Clingy: it spreads the herd, and forgets its patience');

  // ── JITTER ──────────────────────────────────────────────────────────
  //
  // Without it every member of a relay backs off on the same curve from
  // the same instant: the box dies, a hundred nodes count to one together,
  // and it is hit by a hundred simultaneous reconnects exactly as it tries
  // to come up. The nominal curve still doubles; what varies is where in
  // the back half of each interval a given node lands.
  {
    const spread = [];
    const rolls = [0, 0.5, 1, 0.25];
    let n = 0;
    const jittery = sseClient.connect({
      url: 'http://relay/api/relay/stream',
      retryMs: 1000,
      randomImpl: function () { return rolls[n++ % rolls.length]; },
      fetchImpl: function () { return Promise.reject(new Error('down')); },
      setTimeoutImpl: function (fn, ms) { spread.push(ms); return setTimeout(fn, 0); },
      clearTimeoutImpl: clearTimeout,
      // The watchdog runs on its own clock (see sseClient), so it is
      // silenced here rather than sieved out of the backoff list.
      idleTimeoutImpl: function () { return 0; },
      idleClearTimeoutImpl: function () {},
    });
    await new Promise(function (r) { setTimeout(r, 40); });
    jittery.close();

    // 1000 at rolls 0 and 1 is 500 and 1000 — half the interval apart, on
    // the same nominal step.
    if (spread.length >= 2 && spread[0] === 500 && spread[1] === 1500) {
      test.check('the same step lands anywhere in its back half: ' +
        spread.slice(0, 3).join(', ') + 'ms');
    } else {
      test.fail('no jitter: ' + spread.slice(0, 4).join(', '));
    }
  }

  // ── AND THE PATIENCE RESETS ON A CONNECTION ─────────────────────────
  //
  //   Andy: "the sseClient needs to be clingy."
  //
  // THE BUG THIS EXISTS FOR. The reset used to sit where an EVENT was
  // parsed, so a heartbeat did not count — parseChunk(':') answers null
  // and returns first. A node on a quiet relay climbed to the cap across a
  // few restarts and stayed there, and every later restart then cost the
  // full wait. The symptom is a node that re-attaches more slowly the
  // longer it has behaved.
  {
    const waited = [];
    let round = 0;
    const flapping = sseClient.connect({
      url: 'http://relay/api/relay/stream',
      retryMs: 100,
      randomImpl: function () { return 1; },
      setTimeoutImpl: function (fn, ms) { waited.push(ms); return setTimeout(fn, 0); },
      clearTimeoutImpl: clearTimeout,
      // The watchdog runs on its own clock (see sseClient), so it is
      // silenced here rather than sieved out of the backoff list.
      idleTimeoutImpl: function () { return 0; },
      idleClearTimeoutImpl: function () {},
      fetchImpl: function () {
        round += 1;
        // Fail twice, so the backoff climbs; then ACCEPT and drop at once,
        // carrying nothing but a heartbeat. A stream that opened is a
        // relay that is there.
        if (round <= 2) return Promise.reject(new Error('down'));
        return Promise.resolve({
          ok: true,
          body: { getReader: function () {
            let served = false;
            return { read: function () {
              if (served) return Promise.resolve({ done: true });
              served = true;
              return Promise.resolve({ done: false, value: new TextEncoder().encode(':\n\n') });
            } };
          } },
        });
      },
    });
    await new Promise(function (r) { setTimeout(r, 60); });
    flapping.close();

    // 100, 200 while failing; then the connection lands and the next wait
    // is 100 again rather than 400.
    const afterConnect = waited[2];
    if (waited[0] === 100 && waited[1] === 200 && afterConnect === 100) {
      test.check('a connection that opened resets the patience: ' +
        waited.slice(0, 3).join(', ') + 'ms — not 400');
    } else {
      test.fail('backoff kept climbing across a good connection: ' +
        waited.slice(0, 4).join(', '));
    }
  }

  // ── A CONNECTION TO NOBODY ──────────────────────────────────────────
  //
  //   Andy: "when a partner receives a connect request from a partner,
  //   does it verify the health of its own connect/sseReader?"
  //
  // It could not, and that is the worst-shaped failure available here.
  // `await reader.read()` returns on bytes or throws on a socket error,
  // and a HALF-OPEN connection does neither: the peer is gone — a killed
  // VM, a dropped NAT mapping, a firewall reaping an idle flow — but no
  // FIN arrived, so the read never returns and never throws. Nothing
  // fails, the retry loop never fires, and the client believes it is
  // attached forever.
  //
  // Being clingy about reconnecting is no use to a client that does not
  // know it has been disconnected. The relay writes `:` every twenty
  // seconds for exactly this, and until now the only thing listening for
  // it was a proxy.
  {
    let aborted = false;
    let fire = null;
    const silent = sseClient.connect({
      url: 'http://relay/api/relay/stream',
      retryMs: 10,
      randomImpl: function () { return 1; },
      idleMs: 50,
      // Captured rather than run, so the watchdog fires when this test
      // says so and the suite does not wait out a real timeout.
      idleTimeoutImpl: function (fn) { fire = fn; return 1; },
      idleClearTimeoutImpl: function () {},
      setTimeoutImpl: function (fn) { return setTimeout(fn, 0); },
      clearTimeoutImpl: clearTimeout,
      fetchImpl: function () {
        return Promise.resolve({
          ok: true,
          // A READ THAT NEVER SETTLES. This is the half-open socket, and
          // it is why the watchdog cannot be replaced by better error
          // handling: there is no error to handle.
          body: { getReader: function () {
            return { read: function () { return new Promise(function () {}); } };
          } },
          signal: null,
        });
      },
    });

    await new Promise(function (r) { setTimeout(r, 20); });

    if (typeof fire === 'function') {
      test.check('a connected stream arms a watchdog rather than trusting the socket');
    } else {
      test.fail('no watchdog armed on a live connection');
    }

    // The watchdog does not invent a recovery path: it abandons the
    // connection, the pending read throws, and that lands in the same
    // catch a real network error would.
    const before = aborted;
    if (fire) fire();
    await new Promise(function (r) { setTimeout(r, 20); });
    silent.close();

    if (before === false) {
      test.check('and when silence runs out it abandons the socket instead of waiting on it');
    } else {
      test.fail('watchdog did nothing');
    }
  }

  // Three missed heartbeats, not one: a relay under load may be late.
  // Observed rather than read — the window is whatever the watchdog was
  // armed with, which is the thing that decides when a socket is abandoned.
  {
    let armedFor = 0;
    const fed = feeds(['event: x\ndata: 1\n\n'], {
      idleTimeoutImpl: function (fn, ms) { armedFor = ms; return 1; },
    });
    await new Promise(function (r) { setTimeout(r, 20); });
    fed.close();

    if (armedFor > 60000 && armedFor < 120000) {
      test.check('silence is allowed to last ' + (armedFor / 1000) +
        's — three missed 20s heartbeats, so lateness is not death');
    } else {
      test.fail('watchdog armed for ' + armedFor + 'ms against a 20s heartbeat');
    }
  }

  // ── AND IT TAKES THE SERVER'S WORD FOR WHEN TO COME BACK ────────────
  //
  //   Andy: "can a relay that knows its shutting down send a message down
  //   the SSE connections to prepare its counterparts to re-connect?"
  //
  // `retry:` is SSE's own field for it and was being dropped on the floor
  // by the parser. Honouring it is what turns a planned restart from a
  // hundred nodes reconnecting into a booting box, being refused, and
  // backing off further — into a hundred nodes arriving once, late enough
  // to be answered.
  {
    const waited = [];
    let round = 0;
    const told = sseClient.connect({
      url: 'http://relay/api/relay/stream',
      retryMs: 100,
      randomImpl: function () { return 1; },
      idleTimeoutImpl: function () { return 0; },
      idleClearTimeoutImpl: function () {},
      setTimeoutImpl: function (fn, ms) { waited.push(ms); return setTimeout(fn, 0); },
      clearTimeoutImpl: clearTimeout,
      fetchImpl: function () {
        round += 1;
        const frame = round === 1 ? 'retry: 3000\n\n' : ':\n\n';
        return Promise.resolve({
          ok: true,
          body: { getReader: function () {
            let served = false;
            return { read: function () {
              if (served) return Promise.resolve({ done: true });
              served = true;
              return Promise.resolve({ done: false, value: new TextEncoder().encode(frame) });
            } };
          } },
        });
      },
    });
    await new Promise(function (r) { setTimeout(r, 40); });
    told.close();

    // The bytes reset the backoff to its 100ms floor; the `retry:` is read
    // after that and overrides it. A later connection carrying only a
    // heartbeat goes back to the floor, because the hint was about one
    // restart and not a new policy.
    if (waited[0] === 3000) {
      test.check('a relay saying "back in 3s" is believed over the floor: ' + waited[0] + 'ms');
    } else {
      test.fail('ignored the hint: ' + waited.slice(0, 3).join(', '));
    }

    if (waited[1] === 100) {
      test.check('and the next stream, which said nothing, returns to the floor');
    } else {
      test.fail('the hint outlived the restart: ' + waited.slice(0, 3).join(', '));
    }
  }

  // ── A 429 IS NOT A FAILURE, IT IS AN INSTRUCTION ────────────────────
  //
  // THE BUG THIS EXISTS FOR, found in the wild the same evening the
  // clinginess shipped. A relay allows six connects a minute per identity,
  // and presence.js says exactly what goes wrong: "an exponential backoff
  // is meant to prevent a connect storm and is also what produces one when
  // it is wrong."
  //
  // An 8s cap with jitter is seven to fifteen reconnects a minute. The
  // allowance is spent, every attempt after it is refused 429, and a
  // refusal carries no bytes so the backoff never resets. A node in that
  // state can NEVER get back in — and the symptom is not "cannot connect",
  // it is a SEARCH THAT FINDS NOBODY, because the post goes out and the
  // reply comes back on a stream that was never allowed to open.
  {
    async function refuses(status, header) {
      const waits = [];
      const h = sseClient.connect({
        url: 'http://relay/api/relay/stream',
        retryMs: 1000,
        randomImpl: function () { return 1; },
        idleTimeoutImpl: function () { return 0; },
        idleClearTimeoutImpl: function () {},
        setTimeoutImpl: function (fn, ms) { waits.push(ms); return setTimeout(fn, 0); },
        clearTimeoutImpl: clearTimeout,
        fetchImpl: function () {
          return Promise.resolve({
            ok: false, status: status,
            headers: { get: function (n) { return n === 'retry-after' ? header : null; } },
          });
        },
      });
      await new Promise(function (r) { setTimeout(r, 50); });
      h.close();
      return waits;
    }

    const ordinary = await refuses(503, null);
    if (ordinary[0] === 1000 && ordinary[1] === 2000) {
      test.check('an ordinary refusal still backs off clingily: ' + ordinary.slice(0, 3).join(', ') + 'ms');
    } else {
      test.fail('503: ' + ordinary.slice(0, 3).join(', '));
    }

    // WELL CLEAR OF THE WINDOW, so the next try is inside the allowance
    // rather than racing it.
    const limited = await refuses(429, null);
    if (limited[0] >= 15000) {
      test.check('but a 429 waits ' + (limited[0] / 1000) + 's, which the 8s cap must not shorten');
    } else {
      test.fail('429 retried after ' + limited[0] + 'ms — straight back into the limit');
    }

    // AND THE SERVER'S OWN NUMBER WINS, because the box that refused is
    // the only one that knows its allowance.
    const told = await refuses(429, '15');
    if (told[0] === 15000) {
      test.check('and Retry-After is obeyed over any constant here: ' + told[0] + 'ms');
    } else {
      test.fail('ignored Retry-After: ' + told[0]);
    }
  }

  // And the ceiling is short enough to catch a restart rather than a death
  // — observed by letting the backoff run to its limit rather than by
  // reading the constant it stops at.
  {
    const waits = [];
    const fed = feeds([null], {
      retryMs: 1000,
      setTimeoutImpl: function (fn, ms) { waits.push(ms); return setTimeout(fn, 0); },
    });
    await new Promise(function (r) { setTimeout(r, 80); });
    fed.close();

    const ceiling = Math.max.apply(null, waits);
    if (waits.length > 3 && ceiling <= 10000) {
      test.check('the longest a node waits to find a relay that came back is ' +
        (ceiling / 1000) + 's, after ' + waits.length + ' tries');
    } else {
      test.fail('backoff reached ' + ceiling + 'ms in ' + waits.length +
        ' tries — a restart takes 2-5 seconds');
    }
  }

  test.subHeading('Who the relay is, pinned as the stream opens');

  // ── WHO THE RELAY IS, PINNED BEFORE THE STREAM CARRIES ANYTHING ──
  //
  // THE BUG THIS EXISTS FOR, and it shipped for about an hour on
  // 2026-09-12 before the live pass caught it by accident.
  //
  // hub.frontDoor admits a relay as a PARTY only if this node has
  // accepted its key (relayKeys.js) — a device enrolment arrives as a
  // post from the relay in its own name, and a relay is not a contact.
  // The pin was established lazily, by answerRelay, on the first
  // enrolment. Which deadlocked: the door refused the offer because
  // nothing was pinned, so the code that pins never ran, so nothing was
  // ever pinned. A node could never accept its first enrolment.
  //
  // INVISIBLE TO EVERY SUITE INCLUDING THE LIVE ONE, because the bug was
  // not in a module. liveRelay.js calls answerRelay.answer() directly and
  // never goes through peerPost.onRequest, so it proved the answerer
  // works while the door in front of it refused every caller. A suite
  // that drives each module cannot see the wiring between two.
  //
  // So the check is about the WIRING: opening a stream pins the relay
  // first. It belongs here rather than being earlier-for-safety, because
  // an offer can only arrive on a stream this node already holds — which
  // makes pinning at stream-open exactly sufficient rather than merely
  // sooner.
  {
    const pinHome = tmpHome();
    auth.saveIdentity(pinHome, auth.generateIdentity('pinner'));
    // A relay to hold a row on, or the probe finds nothing to connect to
    // and openTo never runs.
    fs.mkdirSync(path.join(pinHome, 'app', 'natter'), { recursive: true });
    fs.writeFileSync(
      path.join(pinHome, 'app', 'natter', 'relays.json'),
      JSON.stringify([{ label: 'one', url: 'http://relay-one' }, { label: 'two', url: 'http://relay-two' }])
    );
    const pinned = [];
    const opened = [];
    const P = presenceNode.createPresence({
      rootDir: pinHome,
      jobs: fakeJobs(),
      router: fakeRouter(),
      connectImpl: function (o) { opened.push(o.url); return { close: function () {} }; },
      pinRelay: function (url) { pinned.push(url); return Promise.resolve('k'); },
    });
    seatEveryRelay(pinHome, 'pinner');
    await P.start(keyDoor);

    if (pinned.length && opened.length && pinned.length === opened.length) {
      test.check('every relay it opens a stream to is pinned as well — ' + pinned.length + ' of ' + opened.length);
    } else {
      test.fail('pinned ' + pinned.length + ' of ' + opened.length + ' streams');
    }

    // AND IT SURVIVES A RELAY THAT WILL NOT SAY. A census that fails must
    // not stop the stream: presence is what the stream is for, and an
    // unpinned relay simply does not get party standing.
    const deafHome = tmpHome();
    auth.saveIdentity(deafHome, auth.generateIdentity('pinner2'));
    fs.mkdirSync(path.join(deafHome, 'app', 'natter'), { recursive: true });
    fs.writeFileSync(
      path.join(deafHome, 'app', 'natter', 'relays.json'),
      JSON.stringify([{ label: 'deaf', url: 'http://relay-deaf' }])
    );
    const deafOpened = [];
    const D = presenceNode.createPresence({
      rootDir: deafHome,
      jobs: fakeJobs(),
      router: fakeRouter(),
      connectImpl: function (o) { deafOpened.push(o.url); return { close: function () {} }; },
      pinRelay: function () { return Promise.reject(new Error('census down')); },
    });
    seatEveryRelay(deafHome, 'pinner2');
    await D.start(keyDoor);
    if (deafOpened.length) {
      test.check('and a relay whose census will not answer still gets its stream opened');
    } else {
      test.fail('a failed pin stopped the stream');
    }
  }

  test.subHeading('The credential is made fresh for every attempt');

  // THE live bug, and the reason this check exists. streamMessage carries
  // a unix minute and is checked ±1, so a signature captured once is
  // refused by every reconnect more than two minutes later — and a held
  // connection reconnects for years. It shipped as a constant, survived
  // every lab test, and failed on the real relay within three minutes,
  // because nothing in the lab runs long enough for the minute to roll.
  let madeHeaders = 0;
  const reSigning = sseClient.connect({
    url: 'http://relay/api/relay/stream',
    retryMs: 5,
    headers: function () { madeHeaders += 1; return { 'X-Spirit-Sig': 'sig-' + madeHeaders }; },
    fetchImpl: function () { return Promise.reject(new Error('down')); },
    setTimeoutImpl: function (fn) { return setTimeout(fn, 0); },
    clearTimeoutImpl: clearTimeout,
      // The watchdog runs on its own clock (see sseClient), so it is
      // silenced here rather than sieved out of the backoff list.
      idleTimeoutImpl: function () { return 0; },
      idleClearTimeoutImpl: function () {},
  });
  await new Promise(function (r) { setTimeout(r, 50); });
  reSigning.close();
  if (madeHeaders > 2) {
    test.check('headers are built per attempt, not captured once — ' + madeHeaders + ' times');
  } else {
    test.fail('headers built ' + madeHeaders + ' time(s): a stale credential reconnects forever');
  }

  // And the node must be passing a function rather than an object, or the
  // client's ability to re-sign buys nothing. Asserted on the call, not
  // on the source: a comment cannot satisfy it.
  let sawHeaders = null;
  const spyHome = tmpHome();
  auth.saveIdentity(spyHome, auth.generateIdentity('spy'));
  // A relay to hold a row on, or the probe finds nothing to connect to
  // and openTo never runs.
  fs.mkdirSync(path.join(spyHome, 'app', 'natter'), { recursive: true });
  fs.writeFileSync(
    path.join(spyHome, 'app', 'natter', 'relays.json'),
    JSON.stringify([{ label: 'spy-relay', url: 'http://relay' }])
  );
  const spy = presenceNode.createPresence({
    rootDir: spyHome,
    jobs: fakeJobs(),
    router: fakeRouter(),
    connectImpl: function (o) { sawHeaders = o.headers; return { close: function () {} }; },
  });
  seatEveryRelay(spyHome, 'spy');
  await spy.start(keyDoor);
  if (typeof sawHeaders === 'function') {
    const one = sawHeaders();
    const two = sawHeaders();
    test.check('the node hands the client a header FUNCTION, and it signs each time');
    if (one['X-Spirit-Sig'] && two['X-Spirit-Sig']) {
      test.check('and every call produces a usable signature');
    } else {
      test.fail('signature missing: ' + JSON.stringify(one));
    }
  } else {
    test.fail('the node captured its headers: ' + JSON.stringify(sawHeaders));
  }

  test.subHeading('Merging what several relays say');

  // -- DRIVEN THROUGH THE STREAM, NOT THROUGH A BACK DOOR --------------
  //
  //   Andy: "their internal mechanics shouldn't even be reachable."
  //
  // presenceNode used to expose _roster, _status, _change and _forget,
  // captioned "fed by tests standing in for a relay" — and this suite was
  // the only caller of all four. A hook that exists for one test is a hole
  // in a module's front door that a caller will eventually use, and it
  // hides whether the REAL path works: everything below asserted the
  // merging while never once exercising the lines that route a stream
  // event into it.
  //
  // What replaces them is what a relay actually does. `connectImpl` is a
  // published option, so the suite captures the callbacks presenceNode
  // registers and calls them — which is exactly what sseClient does with
  // bytes off a socket. `onClose` is how a relay stops asserting, so even
  // _forget had a real path sitting next to it.
  const home = tmpHome();
  const me = auth.generateIdentity('me');
  auth.saveIdentity(home, me);
  const jobs = fakeJobs();

  // Two relays this node holds a row on, so start() opens a stream to each.
  fs.mkdirSync(path.join(home, 'app', 'natter'), { recursive: true });
  fs.writeFileSync(
    path.join(home, 'app', 'natter', 'relays.json'),
    JSON.stringify([{ label: 'a', url: 'http://a' }, { label: 'b', url: 'http://b' }])
  );

  const opened = {};
  const P = presenceNode.createPresence({
    rootDir: home,
    jobs: jobs,
    router: fakeRouter(),
    connectImpl: function (o) {
      // The stream URL carries the key; index by the relay it belongs to.
      opened[o.url.split('/api/')[0]] = o;
      return { close: function () {} };
    },
  });

  // Seats on both relays, so openTo accepts each and the streams are
  // opened the way they are in production. This said "a census naming
  // this node" until 2026-09-18 — the node reads its own record now.
  seatEveryRelay(home, 'me');
  await P.start(keyDoor);

  // A relay speaking down the stream it holds for this node.
  function relaySays(relayUrl, event, data) {
    const o = opened[relayUrl];
    if (!o) { test.fail('no stream was opened to ' + relayUrl); return; }
    o.onEvent({ event: event, data: data });
  }

  // And a relay this node can no longer reach: the stream closes, which is
  // the only way production ever stops believing one.
  function relayLost(relayUrl) {
    const o = opened[relayUrl];
    if (!o) { test.fail('no stream to lose at ' + relayUrl); return; }
    o.onClose('gone');
  }

  if (jobs.job && jobs.job.type === 'relay-presence' && jobs.job.kind === 'permanent') {
    test.check('a permanent job carries it, beside fs-watcher and server-stats');
  } else {
    test.fail('job: ' + JSON.stringify(jobs.job));
  }

  // Broadcasts, one key at a time: the relay serves no member list since
  // cycle 3 (0012 widened), so this is the only way a node learns anything.
  relaySays('http://a', 'presence', { key: 'bert', present: false });
  relaySays('http://a', 'presence', { key: 'john', present: true });
  relaySays('http://b', 'presence', { key: 'bert', present: true });
  relaySays('http://b', 'presence', { key: 'zoe', present: false });

  const merged = P.table();
  if (merged.john === true && merged.zoe === false) {
    test.check('one relay each for john and zoe, taken as said');
  } else {
    test.fail('merged: ' + JSON.stringify(merged));
  }

  // The union, and this is the case the merge exists for: absent on one
  // relay and present on another means REACHABLE. An app asking "can I
  // reach bert" is asking about the union and nothing else.
  if (merged.bert === true) {
    test.check('and bert, absent on one and present on another, is reachable');
  } else {
    test.fail('bert should be reachable: ' + JSON.stringify(merged));
  }

  // White needs no entry. A key no relay named is simply not in the map,
  // which is what makes "not known" different from "absent" without a
  // third value to carry around.
  if (!('stranger' in merged)) {
    test.check('a key no relay mentioned is absent from the map, which is white');
  } else {
    test.fail('stranger appeared: ' + JSON.stringify(merged));
  }

  test.subHeading('The shell hears about changes, and only changes');

  const before = jobs.updates.length;
  relaySays('http://a', 'presence', { key: 'john', present: true });
  if (jobs.updates.length === before) {
    test.check('a repeated broadcast publishes nothing — a quiet relay is not news');
  } else {
    test.fail('republished on a repeated broadcast');
  }

  // A relay from before cycle 3 still sends a roster on connect. It is
  // ignored, not merged: a list of members is not something a node takes.
  relaySays('http://a', 'roster', { members: [{ key: 'intruder', present: true }] });
  if (!('intruder' in P.table()) && jobs.updates.length === before) {
    test.check('a roster from an old relay is ignored — no member list is taken');
  } else {
    test.fail('roster was merged: ' + JSON.stringify(P.table()));
  }

  relaySays('http://a', 'presence', { key: 'john', present: false });
  if (jobs.updates.length === before + 1 && P.table().john === false) {
    test.check('and a real change publishes exactly once');
  } else {
    test.fail('updates=' + (jobs.updates.length - before) + ' john=' + P.table().john);
  }

  test.subHeading('A relay we cannot reach stops asserting');

  // The failure that would make the NODE the liar rather than the relay:
  // keeping a dead relay's last word would hold peers green minutes
  // after the connection died.
  relaySays('http://b', 'presence', { key: 'zoe', present: true });
  if (P.table().zoe === true) test.check('zoe is reachable while b is connected');
  else test.fail('setup: ' + JSON.stringify(P.table()));

  relayLost('http://b');
  const after = P.table();
  if (!('zoe' in after)) {
    test.check('and when b is lost, zoe goes back to not-known rather than staying green');
  } else {
    test.fail('stale assertion survived: ' + JSON.stringify(after));
  }

  // bert was present on b and absent on a. Losing b must not leave him
  // green, and must not lose him either — a still says something.
  if (after.bert === false) {
    test.check('while a peer another relay still names keeps that answer');
  } else {
    test.fail('bert after losing b: ' + JSON.stringify(after));
  }

  test.subHeading('Gone is not absent, and the difference is a colour');

  // Found by a visual scenario, which is what visual scenarios are for:
  // it exhibited a state no test here explored, and the state was wrong.
  // A peer removed from a relay showed RED — merely away — for ever, on
  // the strength of a relay that had forgotten them.
  //
  // Absent is a statement about a MEMBER. Gone means there is no row, so
  // the only true thing left is to stop answering for that key at all.
  // Keys of their own, so removing one here cannot quietly change what a
  // later check in this file is asserting about bert or zoe.
  relaySays('http://a', 'presence', { key: 'gonzo', present: false });
  if (P.table().gonzo === false) test.check('a member who is away is absent — red');
  else test.fail('setup: ' + JSON.stringify(P.table()));

  relaySays('http://a', 'presence', { key: 'gonzo', present: false, gone: true });
  if (!('gonzo' in P.table())) {
    test.check('and a member who is REMOVED leaves the table entirely — white, not red');
  } else {
    test.fail('a removed peer stayed known: ' + JSON.stringify(P.table()));
  }

  // And only for the relay that said so. Somebody removed from one relay
  // is still whatever another relay says they are.
  relaySays('http://a', 'presence', { key: 'hattie', present: true });
  relaySays('http://b', 'presence', { key: 'hattie', present: false });
  relaySays('http://a', 'presence', { key: 'hattie', present: false, gone: true });
  if (P.table().hattie === false) {
    test.check('while another relay that still holds them keeps answering');
  } else {
    test.fail('gone on one relay erased the other: ' + JSON.stringify(P.table()));
  }

  test.subHeading('The per-relay detail stays here');

  // Andy's ruling: the shell gets one merged set and apps filter it. The
  // breakdown is needed to decide, so the node keeps it — and the job
  // payload must not carry it.
  const detail = P.detail();
  if (detail['http://a'] && detail['http://a'].bert === false) {
    test.check('the node knows which relay said what');
  } else {
    test.fail('detail: ' + JSON.stringify(detail));
  }

  test.subHeading('A broadcast about a stranger is learned from, then filtered (R27)');

  {
    // THE EIGHTH DISCARD, and by volume the largest. A relay saying a key
    // is present is that relay saying WHERE ITS OWN MEMBER LIVES — the
    // highest-authority route statement there is, arriving free, for every
    // member of every relay this node is on. `knows` dropped it whole, and
    // the url with it, for anybody not already in the book.
    //
    // The filter is right about the PICTURE. It was never about what this
    // node may LEARN, and the two are separate now.
    const home27 = tmpHome();
    auth.saveIdentity(home27, auth.generateIdentity('learner'));
    fs.mkdirSync(path.join(home27, 'app', 'natter'), { recursive: true });
    fs.writeFileSync(
      path.join(home27, 'app', 'natter', 'relays.json'),
      JSON.stringify([{ label: 'r', url: 'http://relay-r' }])
    );

    const noted = [];
    const streams = {};
    const L = presenceNode.createPresence({
      rootDir: home27,
      jobs: fakeJobs(),
      router: fakeRouter(),
      // NOBODY IS A CONTACT. The strictest version of the filter, so a row
      // reaching the shadow cannot be an accident of a lenient `knows`.
      knows: function () { return false; },
      noteSeen: function (key, what) { noted.push({ key: key, what: what }); },
      connectImpl: function (o) { streams[o.url.split('/api/')[0]] = o; return { close: function () {} }; },
    });
    seatEveryRelay(home27, 'learner');
    await L.start(keyDoor);

    function rSays(data) {
      const o = streams['http://relay-r'];
      if (!o) { test.fail('no stream opened to relay-r'); return; }
      o.onEvent({ event: 'presence', data: data });
    }

    rSays({ key: 'STRANGER-1', present: true });

    const got = noted.filter(function (n) { return n.key === 'STRANGER-1'; })[0];
    if (got && got.what && got.what.url === 'http://relay-r') {
      test.check('a stranger arriving on a relay teaches this node where they live');
    } else {
      test.fail('nothing was learned: ' + JSON.stringify(noted));
    }

    // AND THE PICTURE IS UNCHANGED, which is the half that must not move.
    // Learning is not displaying: a search result is not a contact, and a
    // relay must not be able to fill somebody's screen with strangers.
    if (!('STRANGER-1' in L.table())) {
      test.check('and the presence picture still shows only contacts — learning is not displaying');
    } else {
      test.fail('a stranger reached the picture: ' + JSON.stringify(L.table()));
    }

    // ABSENT STILL TEACHES. "Not connected" is a statement ABOUT A MEMBER,
    // so the relay is still saying this person has a row there — which is
    // the route, whatever the dot would be.
    rSays({ key: 'STRANGER-2', present: false });
    if (noted.some(function (n) { return n.key === 'STRANGER-2'; })) {
      test.check('a stranger who is merely away teaches the same route');
    } else {
      test.fail('absent taught nothing: ' + JSON.stringify(noted));
    }

    // GONE TEACHES NOTHING. The relay has said it no longer holds a row
    // for this key, so it is in no position to say where they live — and
    // writing it down would record an address on the word of the one party
    // that just disclaimed it.
    const before = noted.length;
    rSays({ key: 'STRANGER-3', present: false, gone: true });
    if (noted.length === before) {
      test.check('while a relay that has FORGOTTEN somebody teaches nothing about them');
    } else {
      test.fail('gone was written down: ' + JSON.stringify(noted[noted.length - 1]));
    }

    // AND A CACHE THAT THROWS DOES NOT STOP THE STREAM. The picture is the
    // job; the shadow is the bonus.
    const angryStreams = {};
    const angryHome = tmpHome();
    auth.saveIdentity(angryHome, auth.generateIdentity('angry'));
    fs.mkdirSync(path.join(angryHome, 'app', 'natter'), { recursive: true });
    fs.writeFileSync(
      path.join(angryHome, 'app', 'natter', 'relays.json'),
      JSON.stringify([{ label: 'r', url: 'http://relay-angry' }])
    );
    const A = presenceNode.createPresence({
      rootDir: angryHome,
      jobs: fakeJobs(),
      router: fakeRouter(),
      noteSeen: function () { throw new Error('the store is on fire'); },
      connectImpl: function (o) { angryStreams[o.url.split('/api/')[0]] = o; return { close: function () {} }; },
    });
    seatEveryRelay(angryHome, 'angry');
    await A.start(keyDoor);
    angryStreams['http://relay-angry'].onEvent({
      event: 'presence', data: { key: 'ANYONE', present: true },
    });
    if (A.table().ANYONE === true) {
      test.check('and a shadow that refuses a row does not cost this node its presence picture');
    } else {
      test.fail('a throwing cache broke the picture: ' + JSON.stringify(A.table()));
    }
  }

  const published = JSON.stringify(jobs.job.data);
  if (published.indexOf('http://a') === -1 && published.indexOf('http://b') === -1) {
    test.check('and none of it reaches the shell — the payload is keys and verdicts');
  } else {
    test.fail('per-relay detail leaked into the job: ' + published);
  }

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
