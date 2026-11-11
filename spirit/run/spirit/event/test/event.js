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

// event.js: a stream that closed leaves nothing behind (goal/G43.3). One test.run per test (goal/G47.2).
// What the world made, for the tests after it.
const W = {};
test.after(function () {
  if (W.w) { W.w.server.closeAllConnections(); W.w.server.close(); }
  global.setInterval = realSet;
  global.clearInterval = realClear;
});
const NO_SERVER = 'no server: the world failed';

test.run('the world: a server with event.subscribe on it', 0.2, async function () {
  const w = world();
  await new Promise(function (r) { w.server.listen(0, '127.0.0.1', r); });
  W.w = w;
  W.port = w.server.address().port;
  return !!W.port || 'the server has no port';
}, test.limit.quick);

// an open stream holds its heartbeat and its listeners, and hears every event
test.run('one stream open: one heartbeat, one listener on the jobs', 0.2, async function () {
  if (!W.port) return NO_SERVER;
  const w = W.w;
  W.live = await open(W.port);
  await until(function () { return w.held().timers === 1; }, 2000);
  const openHeld = w.held();
  return openHeld.timers === 1 && openHeld.jobUpdated === 1 && openHeld.pageStreams === 1 ? true
    : 'one stream open holds ' + JSON.stringify(openHeld) + ': nothing below can be judged';
}, test.limit.quick);
test.run('it hears a job change', 0.2, async function () {
  if (!W.live) return 'no stream open: the test before failed';
  W.w.jobs.events.emit('job-updated', { id: 'one' });
  const heardIt = await until(function () { return W.live.heard.join('').indexOf('"id":"one"') !== -1; }, 2000);
  return heardIt || 'it heard ' + JSON.stringify(W.live.heard.join('').slice(0, 200));
}, test.limit.quick);

// closed by its client, as a process closes it when its reply has come
test.run('closed: no heartbeat is left, and no listener on any source', 0.2, async function () {
  if (!W.live) return 'no stream open: the test before failed';
  W.live.req.destroy();
  const gone = await until(function () { return same(W.w.held(), nothingHeld); }, 3000);
  return gone || 'closed, it still holds ' + JSON.stringify(W.w.held());
}, test.limit.quick);

// a server's stream the same (X-Spirit-Reader: server, every peerPost opens one)
test.run('open, it witnesses the packets', 0.2, async function () {
  if (!W.port) return NO_SERVER;
  W.reader = await open(W.port, { 'x-spirit-reader': 'server' });
  await until(function () { return W.w.held().packets === 1; }, 2000);
  return W.w.held().packets === 1 || 'open, it holds ' + JSON.stringify(W.w.held());
}, test.limit.quick);
test.run('closed: nothing is left', 0.2, async function () {
  if (!W.reader) return 'no server stream open: the test before failed';
  W.reader.res.destroy();
  const readerGone = await until(function () { return same(W.w.held(), nothingHeld); }, 3000);
  return readerGone || 'closed, it still holds ' + JSON.stringify(W.w.held());
}, test.limit.quick);

// twenty opened and closed, nothing grows
test.run('after twenty, no heartbeat and no listener is left', 0.2, async function () {
  if (!W.port) return NO_SERVER;
  for (let i = 0; i < 20; i++) { const s = await open(W.port, { 'x-spirit-reader': 'server' }); s.req.destroy(); }
  const flat = await until(function () { return same(W.w.held(), nothingHeld); }, 5000);
  return flat || 'after twenty, it still holds ' + JSON.stringify(W.w.held());
}, test.limit.quick);

// one closing leaves the other open
test.run('the other keeps its heartbeat and goes on hearing', 0.2, async function () {
  if (!W.port) return NO_SERVER;
  const w = W.w;
  const a = await open(W.port); const b = await open(W.port);
  await until(function () { return w.held().timers === 2; }, 2000);
  a.req.destroy();
  await until(function () { return w.held().timers === 1; }, 3000);
  w.jobs.events.emit('job-updated', { id: 'two' });
  const bHeard = await until(function () { return b.heard.join('').indexOf('"id":"two"') !== -1; }, 2000);
  const held = w.held();
  b.req.destroy();
  return held.timers === 1 && bHeard ? true : 'held ' + JSON.stringify(held) + ', heard ' + bHeard;
}, test.limit.quick);
