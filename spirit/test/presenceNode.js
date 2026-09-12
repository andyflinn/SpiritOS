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

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-presence-node-'));
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

test.startTest('Presence 2 — the node holds the sockets');

async function run() {
  test.subHeading('Reading the protocol, including the parts that look like nothing');

  const heartbeat = sseClient.parseChunk(':');
  if (heartbeat === null) {
    test.check('a lone colon is a heartbeat and not an event');
  } else {
    test.fail('heartbeat parsed as: ' + JSON.stringify(heartbeat));
  }

  const msg = sseClient.parseChunk('event: roster\ndata: {"members":[]}');
  if (msg && msg.event === 'roster' && msg.data && Array.isArray(msg.data.members)) {
    test.check('an event carries its name and its parsed data');
  } else {
    test.fail('parse: ' + JSON.stringify(msg));
  }

  // The spec allows a space after the colon and most servers write one.
  // A parser that keeps it turns every key into a key with a space in
  // front, which compares unequal to itself everywhere else.
  const spaced = sseClient.parseChunk('event: presence\ndata: {"key":"abc"}');
  if (spaced && spaced.data && spaced.data.key === 'abc') {
    test.check('and the space after the colon is not part of the value');
  } else {
    test.fail('spacing: ' + JSON.stringify(spaced));
  }

  test.subHeading('A stream that is cut comes back, and does not hammer');

  // A fetch that fails forever. The point is the SHAPE of the retries.
  let attempts = 0;
  const waits = [];
  const failing = sseClient.connect({
    url: 'http://relay/api/relay/stream',
    retryMs: 10,
    fetchImpl: function () { attempts += 1; return Promise.reject(new Error('down')); },
    setTimeoutImpl: function (fn, ms) { waits.push(ms); return setTimeout(fn, 0); },
    clearTimeoutImpl: clearTimeout,
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
      connectImpl: function (o) { opened.push(o.url); return { close: function () {} }; },
      pinRelay: function (url) { pinned.push(url); return Promise.resolve('k'); },
    });
    await P.start(function () {
      return Promise.resolve({ status: 200, text: JSON.stringify({ peers: [
        { name: 'pinner', publicLabel: 'pinner', publicKey: auth.loadIdentity(pinHome).publicKey },
      ] }) });
    });

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
      connectImpl: function (o) { deafOpened.push(o.url); return { close: function () {} }; },
      pinRelay: function () { return Promise.reject(new Error('census down')); },
    });
    await D.start(function () {
      return Promise.resolve({ status: 200, text: JSON.stringify({ peers: [
        { name: 'pinner2', publicLabel: 'pinner2', publicKey: auth.loadIdentity(deafHome).publicKey },
      ] }) });
    });
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
    connectImpl: function (o) { sawHeaders = o.headers; return { close: function () {} }; },
  });
  await spy.start(function () {
    return Promise.resolve({ status: 200, text: JSON.stringify({ peers: [
      { name: 'spy', publicLabel: 'spy', publicKey: auth.loadIdentity(spyHome).publicKey },
    ] }) });
  });
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

  const home = tmpHome();
  const me = auth.generateIdentity('me');
  auth.saveIdentity(home, me);
  const jobs = fakeJobs();
  const P = presenceNode.createPresence({ rootDir: home, jobs: jobs });
  await P.start(function () {
    return Promise.resolve({ status: 403, text: '{}' });
  });

  if (jobs.job && jobs.job.type === 'relay-presence' && jobs.job.kind === 'permanent') {
    test.check('a permanent job carries it, beside fs-watcher and server-stats');
  } else {
    test.fail('job: ' + JSON.stringify(jobs.job));
  }

  P._roster('http://a', { members: [
    { key: 'bert', present: false },
    { key: 'john', present: true },
  ] });
  P._roster('http://b', { members: [
    { key: 'bert', present: true },
    { key: 'zoe', present: false },
  ] });

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
  P._roster('http://a', { members: [
    { key: 'bert', present: false },
    { key: 'john', present: true },
  ] });
  if (jobs.updates.length === before) {
    test.check('an identical roster publishes nothing — a quiet relay is not news');
  } else {
    test.fail('republished on an identical roster');
  }

  P._change('http://a', { key: 'john', present: false });
  if (jobs.updates.length === before + 1 && P.table().john === false) {
    test.check('and a real change publishes exactly once');
  } else {
    test.fail('updates=' + (jobs.updates.length - before) + ' john=' + P.table().john);
  }

  test.subHeading('A relay we cannot reach stops asserting');

  // The failure that would make the NODE the liar rather than the relay:
  // keeping a dead relay's last roster would hold peers green minutes
  // after the connection died.
  P._change('http://b', { key: 'zoe', present: true });
  if (P.table().zoe === true) test.check('zoe is reachable while b is connected');
  else test.fail('setup: ' + JSON.stringify(P.table()));

  P._forget('http://b');
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
  P._change('http://a', { key: 'gonzo', present: false });
  if (P.table().gonzo === false) test.check('a member who is away is absent — red');
  else test.fail('setup: ' + JSON.stringify(P.table()));

  P._change('http://a', { key: 'gonzo', present: false, gone: true });
  if (!('gonzo' in P.table())) {
    test.check('and a member who is REMOVED leaves the table entirely — white, not red');
  } else {
    test.fail('a removed peer stayed known: ' + JSON.stringify(P.table()));
  }

  // And only for the relay that said so. Somebody removed from one relay
  // is still whatever another relay says they are.
  P._change('http://a', { key: 'hattie', present: true });
  P._change('http://b', { key: 'hattie', present: false });
  P._change('http://a', { key: 'hattie', present: false, gone: true });
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
