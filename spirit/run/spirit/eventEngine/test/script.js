'use strict';

// spirit/run/spirit/eventEngine/test/script.js
// The tests of spirit/eventEngine/script.js (spec: ./script.md; goal/G43.3). Andy, the box: "no leftover timers after a stream
// closes". spirit.subscribe (event.subscribe before goal/G49.23, box v22 Part 2) runs on a real http server here, with stand-ins for what feeds it, and a real client opens
// the stream and closes it, the way a process does when its one reply has come.

const http = require('http');
const path = require('path');
const { EventEmitter } = require('events');
const RUN = path.resolve(__dirname, '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const { createEvents } = LOADER.requireScript('spirit/eventEngine/script.js');

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
  // AS THE NODE'S DOOR HANDS IT OVER: the call's body read to its end first ({ call, args }, POST /spirit), so the
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
    req.end(JSON.stringify({ call: 'spirit.subscribe', args: {} }));
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

test.run('a server with spirit.subscribe on it listens', 0.2, async function () {
  const w = world();
  await new Promise(function (r) { w.server.listen(0, '127.0.0.1', r); });
  W.w = w;
  W.port = w.server.address().port;
  return !!W.port || false;
}, test.limit.quick);

// A QUIET NODE IS NEVER TAKEN FOR DEAD (goal/G47.1, box v148: "the node beats each second when it has nothing else to send, on
// the page's stream (spirit/eventEngine/script.js, every 20 s today)"). One stream open on a node with nothing to send, its bytes timed
// as they come for 4 s: no gap between two of them is longer than 1.5 s.
test.run('a quiet stream hears a beat each second, with no gap of more than 1.5 s in 4 s', 0.8, async function () {
  if (!W.port) return false;
  const times = [];
  const t0 = Date.now();
  const s = await new Promise(function (resolve, reject) {
    const req = http.request({ port: W.port, host: '127.0.0.1', method: 'POST', path: '/' }, function (res) {
      res.on('data', function () { times.push(Date.now()); });
      res.on('error', function () { /* closed below */ });
      resolve({ req: req, res: res });
    });
    req.on('error', reject);
    req.end(JSON.stringify({ call: 'spirit.subscribe', args: {} }));
  });
  s.req.on('error', function () {});
  await sleep(4000);
  s.req.destroy();
  const marks = [t0].concat(times).concat([t0 + 4000]);
  let worst = 0;
  for (let i = 1; i < marks.length; i++) worst = Math.max(worst, marks[i] - marks[i - 1]);
  return worst <= 1500 || false;
}, test.limit.slow);
// an open stream holds its heartbeat and its listeners, and hears every event
test.run('with one stream open, there is one heartbeat and one listener on the jobs', 0.2, async function () {
  if (!W.port) return false;
  const w = W.w;
  W.live = await open(W.port);
  await until(function () { return w.held().timers === 1; }, 2000);
  const openHeld = w.held();
  return openHeld.timers === 1 && openHeld.jobUpdated === 1 && openHeld.pageStreams === 1 ? true
    : false;
}, test.limit.quick);
test.run('the open stream hears a job change', 0.2, async function () {
  if (!W.live) return false;
  W.w.jobs.events.emit('job-updated', { id: 'one' });
  const heardIt = await until(function () { return W.live.heard.join('').indexOf('"id":"one"') !== -1; }, 2000);
  return heardIt || false;
}, test.limit.quick);

// closed by its client, as a process closes it when its reply has come
test.run('once its client closes the stream, no heartbeat is left, and no listener on any source', 0.2, async function () {
  if (!W.live) return false;
  W.live.req.destroy();
  const gone = await until(function () { return same(W.w.held(), nothingHeld); }, 3000);
  return gone || false;
}, test.limit.quick);

// a server's stream the same (X-Spirit-Reader: server, every peerPost opens one)
test.run('a server\'s stream, while open, witnesses the packets', 0.2, async function () {
  if (!W.port) return false;
  W.reader = await open(W.port, { 'x-spirit-reader': 'server' });
  await until(function () { return W.w.held().packets === 1; }, 2000);
  return W.w.held().packets === 1 || false;
}, test.limit.quick);
test.run('once a server\'s stream is closed, nothing is left', 0.2, async function () {
  if (!W.reader) return false;
  W.reader.res.destroy();
  const readerGone = await until(function () { return same(W.w.held(), nothingHeld); }, 3000);
  return readerGone || false;
}, test.limit.quick);

// twenty opened and closed, nothing grows
test.run('after twenty streams are opened and closed, no heartbeat and no listener is left', 0.2, async function () {
  if (!W.port) return false;
  for (let i = 0; i < 20; i++) { const s = await open(W.port, { 'x-spirit-reader': 'server' }); s.req.destroy(); }
  const flat = await until(function () { return same(W.w.held(), nothingHeld); }, 5000);
  return flat || false;
}, test.limit.quick);

// one closing leaves the other open
test.run('when one of two streams closes, the other keeps its heartbeat and goes on hearing', 0.2, async function () {
  if (!W.port) return false;
  const w = W.w;
  const a = await open(W.port); const b = await open(W.port);
  await until(function () { return w.held().timers === 2; }, 2000);
  a.req.destroy();
  await until(function () { return w.held().timers === 1; }, 3000);
  w.jobs.events.emit('job-updated', { id: 'two' });
  const bHeard = await until(function () { return b.heard.join('').indexOf('"id":"two"') !== -1; }, 2000);
  const held = w.held();
  b.req.destroy();
  return held.timers === 1 && bHeard ? true : false;
}, test.limit.quick);

// A PAGE'S CONNECT REACHES EVERY APP SERVER (goal/G47.5, part 2; Andy: "the node forwards a loopback connect to the as server as
// a normal request, so that spirit/server/app/script.js knows a loopback client connected", "the connect to all app servers doesn't
// need a loopback mark, it will reach the app server with the local node's ID", "47.5 WILL NOT HAVE ANY APP-SPECIFIC SHIT IN
// IT.", "Go on 47.5 fix, part two"). On a scratch node of lab's: a planted app server whose bootstrap writes down every
// subscriber that is its own node; a page opens the node's event stream, and that subscriber is written down.
const LABH = LOADER.requireScript('spirit/testicle/headLessChrome/script.js');
const fs = require('fs');
const SELFSUB = 'zzselfsub';
const N = {};
test.after(async function () {
  try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
  await sleep(500);
  try { if (N.s) LABH.freeTree(N.s); } catch (e) { /* scratch */ }
});
function selfSubTree() {
  const root = LABH.scratchTree().root;
  const run = path.join(root, 'spirit', 'run');
  const dir = path.join(run, 'spirit', 'app', SELFSUB);
  fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
  fs.writeFileSync(path.join(dir, SELFSUB + '.json'), JSON.stringify({ identity: { icon: '🧪', label: SELFSUB, intrinsic: false }, mount: { [SELFSUB + '.js']: true }, shell: { true: false, mount: false, tile: false }, node: { mount: true } }));
  fs.writeFileSync(path.join(dir, SELFSUB + '.js'), "'use strict';\nrequire('../../script.js');\nspirit.requireScript('spirit/app/" + SELFSUB + "/server/server.js');\n");
  fs.writeFileSync(path.join(dir, 'server', 'server.js'), [
    "'use strict';",
    "require('../../../script.js');", // the loader is spirit/script.js (goal/G49.23; spirit.js is gone)
    "const fs = require('fs');",
    "const path = require('path');",
    "const SEEN = path.join(__dirname, '..', '..', '..', 'state', 'app', '" + SELFSUB + "', 'seen.json');",
    "spirit.requireScript('spirit/server/app/script.js').serve({ ping: { request: {}, reply: { pong: true }, handler: function () { return { pong: true }; } } }, {",
    "  publisher: { family: '" + SELFSUB + "', waitMs: 5000, bootstrap: function (key) {",
    "    if (spirit.nodeFacts && key && key === spirit.nodeFacts.key) { try { fs.appendFileSync(SEEN, 'self\\n'); } catch (e) { /* judged by its absence */ } }",
    "    return [];",
    "  } },",
    "});",
  ].join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'api.js'), 'module.exports = { verbs: { ping: {} } };\n');
  // Its state folder by spirit.statePath (goal/G49.17): spirit/state/app/<name>/, where active switches its server on.
  const state = path.join(run, ...LOADER.statePath('spirit/app/' + SELFSUB).split('/'));
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(state, 'node.json'), JSON.stringify({ active: true }));
  return { root: root, run: run, seen: path.join(state, 'seen.json') };
}
const nodePost = function (call, args) {
  return fetch(N.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args }) })
    .then(function (r) { return r.status; }, function () { return 0; });
};
const selfSubs = function () { try { return fs.readFileSync(N.s.seen, 'utf8').split('\n').filter(Boolean).length; } catch (e) { return 0; } };
test.run('a page\'s connect to the node\'s event stream reaches each app server as a subscribe under the node\'s own key', 0.2, async function () {
  N.s = selfSubTree();
  const port = await LABH.freePort();
  N.child = LABH.startNodeOn(N.s.run, port);
  N.base = 'http://127.0.0.1:' + port;
  const up = await LABH.until(function () { return nodePost(LOADER.dottedPath('spirit/app/' + SELFSUB) + '.ping', {}).then(function (s) { return s === 200; }); }, 60000);
  if (!up) return false;
  const before = selfSubs();
  const page = await new Promise(function (resolve) {
    const req = http.request({ port: port, host: '127.0.0.1', method: 'POST', path: '/spirit', headers: { 'content-type': 'application/json' } }, function (res) {
      res.on('data', function () {}); res.on('error', function () {}); resolve(req);
    });
    req.on('error', function () { resolve(null); });
    req.end(JSON.stringify({ call: 'spirit.subscribe', args: {} }));
  });
  if (!page) return false;
  page.on('error', function () {});
  const reached = await until(function () { return selfSubs() > before; }, 8000);
  page.destroy();
  return reached || false;
}, test.limit.slow);
