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
