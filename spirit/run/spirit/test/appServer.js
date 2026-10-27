'use strict';

// spirit/run/spirit/test/appServer.js
// The tests of spirit/appServer.js, and of no other module (spec: ./appServer.md; goal/G41.11). The real appServer
// serves one server on a pipe of its own in a temp folder, publishing a stream and following it: its client half
// subscribes to its own publisher half, and the publisher hands its bootstrap back over the same pipe, to its own
// streamListener, row by row. The one spirit object is a stand-in, so nothing reaches a real node: the families answer
// by posting to that pipe, and the rows the publisher sends can be held back until the test lets them go.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const Module = require('module');
const RUN = path.resolve(__dirname, '../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'appServer.js');
const TRANSLATOR = path.join(RUN, 'shell', 'shared', 'js', 'deskData.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function (ms) { return new Promise(function (r) { setTimeout(r, ms || 20); }); };

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'appServer-test-'));
const PIPE = path.join(TMP, 'door.sock');
const PUBLISHER = 'KEY-DESK';   // the key the client follows: its publisher's
const SELF = 'KEY-CLIENT';      // the key the publisher sees subscribing: the client's
// One call on the pipe, as the node makes it: {verb: args}, the caller's key in a header.
function post(verb, args, callerKey) {
  return new Promise(function (resolve) {
    const body = JSON.stringify({ [verb]: args });
    const req = http.request({ socketPath: PIPE, path: '/', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Spirit-Caller': callerKey } }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () { let b = null; try { b = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { b = null; } resolve({ status: res.statusCode, body: b }); });
    });
    req.on('error', function (e) { resolve({ status: 0, body: { error: e.message } }); });
    req.end(body);
  });
}
// The rows the publisher sends wait here while held; let go, they reach the streamListener in order.
const gate = { held: false, waiting: [] };
function deliver(json) {
  const go = function () { return post('streamListener', { json: json }, PUBLISHER).then(function (r) { return r.status === 200 ? r.body : Promise.reject(new Error('refused ' + short(r.body))); }); };
  if (!gate.held) return go();
  return new Promise(function (resolve, reject) { gate.waiting.push(function () { go().then(resolve, reject); }); });
}
function release() { gate.held = false; const w = gate.waiting.splice(0); w.forEach(function (fn) { fn(); }); }
const asked = [];
const fake = {
  require: function (p, key) {
    const q = String(p);
    if (/spirit\/auth\/api\.js$/.test(q)) {
      return Promise.resolve({
        grant: function (a) { asked.push({ verb: 'auth.grant', args: a }); return Promise.resolve({ ok: true }); },
        search: function () { return Promise.resolve({ items: [], more: false }); },
      });
    }
    // A family under a key: the publisher's (the client subscribing) or the client's (the publisher delivering).
    if (/\.family\/api\.js$/.test(q) && key) {
      return Promise.resolve({
        subscribe: function (a) { asked.push({ verb: 'subscribe', key: key, args: a }); return post('subscribe', a, SELF).then(function (r) { return r.body; }); },
        streamListener: function (a) { return deliver(a.json); },
      });
    }
    return Promise.resolve({});
  },
  outcome: function (p) { return Promise.resolve(p).then(function (b) { return { status: 200, body: b }; }, function (e) { return { status: 500, body: { ok: false, error: String(e && e.message || e) } }; }); },
  events: { publish: function () {}, subscribe: function () {} },
};
const realLoad = Module._load;
Module._load = function (request, parent) {
  // spirit.js is the stand-in for every module that requires it: the real one would write its own require onto it.
  if (/(^|\/)spirit\.js$/.test(request) && parent && String(parent.filename).indexOf(RUN) === 0) { globalThis.spirit = fake; return fake; }
  return realLoad.apply(this, arguments);
};
globalThis.spirit = fake;
process.argv = [process.argv[0], path.join(TMP, 'desk.js'), '--pipe', PIPE];

// What the publisher's bootstrap holds now: the goal whole, its items' facts.
let bootstrap = [];
const GOAL = { id: 'goal/G9', goal: '', title: 'the goal', version: 1 };
const item = function (n, extra) { return Object.assign({ id: 'goal/G9.' + n, goal: 'goal/G9', title: 'item ' + n, version: 1 }, extra || {}); };
const row = function (f) { return { verb: 'goal.whole', goal: 9, item: f }; };

test.startTest('appServer.js: a subscribe keeps the cache until the new push lands (goal/G41.11)');

(async function () {
  const A = require(FILE);
  const s = A.serve({ ping: { request: {}, reply: { pong: true }, handler: function () { return { pong: true }; } } }, {
    stream: { module: 'process/js/desk', translator: TRANSLATOR },
    publisher: { family: 'desk', bootstrap: function () { return bootstrap.slice(); }, waitMs: 5000 },
  });
  await tick(100);
  const D = A.data;
  ok(!!D && typeof D.get === 'function' && !!s && typeof s.subscribe === 'function', 'it serves, keeps a data set and has its client half (subscribe)', 'data ' + typeof (D && D.get) + ', subscribe ' + typeof (s && s.subscribe));
  if (!D || !s || typeof s.subscribe !== 'function') return;
  const has = function (n) { return !!D.get('deskItems/goal/G9.' + n); };

  test.subHeading('the first subscribe: the push lands, the cache holds it');
  bootstrap = [row(GOAL), row(item(1)), row(item(2))];
  const first = await s.subscribe(PUBLISHER, 'desk');
  await tick(200);
  ok(first === true && asked.some(function (a) { return a.verb === 'subscribe' && a.key === PUBLISHER; }) && asked.some(function (a) { return a.verb === 'auth.grant'; }),
    'a subscribe follows the publisher\'s key and asks its family to subscribe it', 'answered ' + short(first) + ', asked ' + short(asked));
  ok(has(1) && has(2), 'the bootstrap lands in the cache: both items', short({ one: D.get('deskItems/goal/G9.1'), two: D.get('deskItems/goal/G9.2') }));

  test.subHeading('a subscribe again: the old cache stays until the new push lands (Andy, Q5: "YES")');
  // The new push holds item 1 changed and no item 2.
  bootstrap = [row(GOAL), row(item(1, { title: 'item 1, renamed', version: 2 }))];
  gate.held = true;
  const again = s.subscribe(PUBLISHER, 'desk');
  await tick(200);
  ok(has(1) && has(2) && D.get('deskItems/goal/G9.1').title === 'item 1' && D.get('desk/current') === 'goal/G9',
    'subscribed again, its push not yet landed: every row it kept is still there, as it was', 'kept: ' + short({ one: D.get('deskItems/goal/G9.1'), two: D.get('deskItems/goal/G9.2'), current: D.get('desk/current') }));
  release();
  await again;
  await tick(300);
  ok(has(1) && D.get('deskItems/goal/G9.1').title === 'item 1, renamed', 'once the push lands, a row it holds is current', 'item 1: ' + short(D.get('deskItems/goal/G9.1')));
  ok(!has(2), 'and the cache is replaced whole by it: a row the new push does not hold is gone', 'item 2 still kept: ' + short(D.get('deskItems/goal/G9.2')));
}()).then(function () {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* a temp folder left is no failure */ }
  test.reportSuccessFailureCount(); process.exit(process.exitCode || 0);
}, function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
