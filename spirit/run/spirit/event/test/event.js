'use strict';

// spirit/run/spirit/event/test/event.js
// The tests of spirit/event/event.js (spec: ./event.md; goal/G43.3). Andy, the box: "no leftover timers after a stream
// closes". event.subscribe runs on a real http server here, with stand-ins for what feeds it, and a real client opens
// the stream and closes it, the way a process does when its one reply has come.

const http = require('http');
const path = require('path');
const { EventEmitter } = require('events');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { createEvents } = require(path.join(RUN, 'spirit', 'event', 'event.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function until(fn, ms) { for (let i = 0; i < ms / 20; i++) { if (fn()) return true; await sleep(20); } return !!fn(); }

// The heartbeats alive: every setInterval made and not cleared since this suite began, whoever made it.
const timers = new Set();
const realSet = global.setInterval;
const realClear = global.clearInterval;
global.setInterval = function () { const t = realSet.apply(this, arguments); timers.add(t); return t; };
global.clearInterval = function (t) { timers.delete(t); return realClear.call(this, t); };

// What feeds event.js, each source counting the subscribers it holds.
function source() {
  const subs = new Set();
  return { subs: subs, subscribe: function (fn) { subs.add(fn); return function () { subs.delete(fn); }; } };
}
function world() {
  const jobs = { events: new EventEmitter(), listJobs: function () { return []; }, fsTreeCommands: function () { return []; } };
  const relayEvents = source(); const renames = source(); const taken = source(); const witnessed = source();
  const arrivals = { subscribe: taken.subscribe, witness: witnessed.subscribe };
  const pageStreams = new Set();
  const events = createEvents({ jobs: jobs, relayEvents: relayEvents, arrivals: arrivals, renames: renames, pageStreams: pageStreams,
    readJsonBody: function () { return Promise.resolve({}); }, bodyRefused: function () {} });
  // AS THE NODE'S DOOR HANDS IT OVER: the call's body read to its end first ({ call, args }, POST /api/spirit), so the
  // request is over before handleSubscribe sees it. Called straight from the request, its close still comes, and the leak
  // does not show.
  const server = http.createServer(function (req, res) {
    req.resume();
    req.on('end', function () { setTimeout(function () { events.handleSubscribe(req, res); }, 10); });
  });
  const held = function () {
    return { timers: timers.size, jobUpdated: jobs.events.listenerCount('job-updated'), jobDeleted: jobs.events.listenerCount('job-deleted'),
      relay: relayEvents.subs.size, renames: renames.subs.size, packets: taken.subs.size + witnessed.subs.size, pageStreams: pageStreams.size };
  };
  return { jobs: jobs, server: server, held: held };
}
// One stream, open once its first bytes came: what it heard, and how it closes.
function open(port, headers) {
  return new Promise(function (resolve, reject) {
    const heard = [];
    const req = http.request({ port: port, host: '127.0.0.1', method: 'POST', path: '/', headers: headers || {} }, function (res) {
      res.on('data', function (c) { heard.push(String(c)); });
      res.on('error', function () { /* the close below */ });
      resolve({ heard: heard, req: req, res: res });
    });
    req.on('error', reject);
    req.end(JSON.stringify({ call: 'event.subscribe', args: {} }));
  }).then(function (s) { s.req.on('error', function () {}); return s; });
}
const nothingHeld = { timers: 0, jobUpdated: 0, jobDeleted: 0, relay: 0, renames: 0, packets: 0, pageStreams: 0 };
const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

test.startTest('event.js: a stream that closed leaves nothing behind (goal/G43.3)');

(async function () {
  const w = world();
  await new Promise(function (r) { w.server.listen(0, '127.0.0.1', r); });
  const port = w.server.address().port;
  try {
    test.subHeading('an open stream holds its heartbeat and its listeners, and hears every event');
    const live = await open(port);
    await until(function () { return w.held().timers === 1; }, 2000);
    const openHeld = w.held();
    ok(openHeld.timers === 1 && openHeld.jobUpdated === 1 && openHeld.pageStreams === 1, 'one stream open: one heartbeat, one listener on the jobs',
      'one stream open holds ' + JSON.stringify(openHeld) + ': nothing below can be judged');
    w.jobs.events.emit('job-updated', { id: 'one' });
    const heardIt = await until(function () { return live.heard.join('').indexOf('"id":"one"') !== -1; }, 2000);
    ok(heardIt, 'it hears a job change', 'it heard ' + JSON.stringify(live.heard.join('').slice(0, 200)));

    test.subHeading('closed by its client, as a process closes it when its reply has come');
    live.req.destroy();
    const gone = await until(function () { return same(w.held(), nothingHeld); }, 3000);
    ok(gone, 'closed: no heartbeat is left, and no listener on any source', 'closed, it still holds ' + JSON.stringify(w.held()));

    test.subHeading('a server\'s stream the same (X-Spirit-Reader: server, every peerPost opens one)');
    const reader = await open(port, { 'x-spirit-reader': 'server' });
    await until(function () { return w.held().packets === 1; }, 2000);
    ok(w.held().packets === 1, 'open, it witnesses the packets', 'open, it holds ' + JSON.stringify(w.held()));
    reader.res.destroy();
    const readerGone = await until(function () { return same(w.held(), nothingHeld); }, 3000);
    ok(readerGone, 'closed: nothing is left', 'closed, it still holds ' + JSON.stringify(w.held()));

    test.subHeading('twenty opened and closed, nothing grows');
    for (let i = 0; i < 20; i++) { const s = await open(port, { 'x-spirit-reader': 'server' }); s.req.destroy(); }
    const flat = await until(function () { return same(w.held(), nothingHeld); }, 5000);
    ok(flat, 'after twenty, no heartbeat and no listener is left', 'after twenty, it still holds ' + JSON.stringify(w.held()));

    test.subHeading('one closing leaves the other open');
    const a = await open(port); const b = await open(port);
    await until(function () { return w.held().timers === 2; }, 2000);
    a.req.destroy();
    await until(function () { return w.held().timers === 1; }, 3000);
    w.jobs.events.emit('job-updated', { id: 'two' });
    const bHeard = await until(function () { return b.heard.join('').indexOf('"id":"two"') !== -1; }, 2000);
    ok(w.held().timers === 1 && bHeard, 'the other keeps its heartbeat and goes on hearing', 'held ' + JSON.stringify(w.held()) + ', heard ' + bHeard);
    b.req.destroy();
  } finally {
    w.server.closeAllConnections();
    w.server.close();
    global.setInterval = realSet;
    global.clearInterval = realClear;
  }
}()).then(function () { test.reportSuccessFailureCount(); setTimeout(function () { process.exit(process.exitCode || 0); }, 50); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); setTimeout(function () { process.exit(process.exitCode || 0); }, 50); });
