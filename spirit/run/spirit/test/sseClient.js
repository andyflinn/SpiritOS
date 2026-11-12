'use strict';

// spirit/run/spirit/test/sseClient.js
// The tests of spirit/sseClient.js, and of no other module (spec: ./sseClient.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, the cycle "the top 10 reds of Andy's testicle", 9: sseClient
// was red in the garbage rule because it had none).
//
// connect(opts): reading Server-Sent Events, a parser and a reconnect loop. Its fetch, its timers and its randomness are
// handed in (fetchImpl, setTimeoutImpl, clearTimeoutImpl, randomImpl, idleTimeoutImpl): the fetch answers what the test
// plants, and a timer is kept, not run, so each wait it asks for is read.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { connect } = require(path.join(RUN, 'spirit', 'sseClient.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = function () { return new Promise(function (r) { setTimeout(r, 50); }); };
// A response whose body is the chunks given, then its end (or none: held open).
function streamed(chunks, end) {
  const enc = new TextEncoder();
  return { ok: true, status: 200, body: new ReadableStream({ start: function (c) { chunks.forEach(function (s) { c.enqueue(enc.encode(s)); }); if (end !== false) c.close(); } }) };
}
// A client on a planted fetch: every timer kept, randomness fixed, what it says recorded.
function client(answers, extra) {
  const said = { events: [], opens: 0, closes: [], timers: [], fetched: [] };
  let n = 0;
  const c = connect(Object.assign({
    url: 'https://relay.example/stream',
    headers: function () { return { 'X-Spirit-Sig': 'sig' + n }; },
    fetchImpl: function (url, init) { said.fetched.push({ url: url, headers: init && init.headers }); const a = answers[Math.min(n, answers.length - 1)]; n += 1; return typeof a === 'function' ? a() : Promise.resolve(a); },
    setTimeoutImpl: function (fn, ms) { said.timers.push({ fn: fn, ms: ms }); return said.timers.length; },
    clearTimeoutImpl: function () {},
    idleTimeoutImpl: function () { return 0; },
    idleClearTimeoutImpl: function () {},
    randomImpl: function () { return 1; },
    onEvent: function (m) { said.events.push(m); },
    onOpen: function () { said.opens += 1; },
    onClose: function (reason, detail) { said.closes.push({ reason: reason, detail: detail }); },
  }, extra || {}));
  said.client = c;
  return said;
}

// ── a stream read and parsed ──
let A = null;
test.run('the world: a stream of two events, a heartbeat between them, then its end', 0.2, async function () {
  A = client([streamed([':hb\n\n', 'event: route\ndata: {"key":"k1"}\n\n', ':\n\n', 'event: note\ndata: line one\ndata: line two\n\n'])]);
  await settle();
  return A.fetched.length >= 1 || 'nothing was fetched';
}, test.limit.quick);
test.run('it fetches its url with the headers its function gives', 0.2, function () {
  if (!A) return 'no stream: the world failed';
  const f = A.fetched[0] || {};
  return (f.url === 'https://relay.example/stream' && f.headers && f.headers['X-Spirit-Sig'] === 'sig0') || 'fetched ' + short(f);
}, test.limit.quick);
test.run('an open stream is said once', 0.2, function () {
  if (!A) return 'no stream: the world failed';
  return A.opens === 1 || 'onOpen said ' + A.opens + ' times';
}, test.limit.quick);
test.run('each event comes with its name, JSON data parsed', 0.2, function () {
  if (!A) return 'no stream: the world failed';
  const e = A.events[0] || {};
  return (e.event === 'route' && e.data && e.data.key === 'k1') || 'the first event: ' + short(e);
}, test.limit.quick);
test.run('data lines of one event are joined, and a heartbeat is no event', 0.2, function () {
  if (!A) return 'no stream: the world failed';
  return (A.events.length === 2 && A.events[1].event === 'note' && A.events[1].data === 'line one\nline two') || 'events: ' + short(A.events);
}, test.limit.quick);
test.run('a stream that ends is said as ended, and a reconnect is asked after the first wait', 0.2, function () {
  if (!A) return 'no stream: the world failed';
  return ((A.closes[0] || {}).reason === 'ended' && A.timers.length >= 1 && A.timers[0].ms === 1000) || 'closes ' + short(A.closes) + ', timers ' + short(A.timers.map(function (t) { return t.ms; }));
}, test.limit.quick);

// ── refusals ──
test.run('a refusal is said with its status, and the code and error of its JSON body', 0.2, async function () {
  const said = client([{ ok: false, status: 403, headers: { get: function () { return null; } }, text: function () { return Promise.resolve('{"code":"bad-stream-signature","error":"bad stream signature"}'); } }]);
  await settle();
  const c = said.closes[0] || {};
  return (c.reason === 'refused: 403' && c.detail && c.detail.status === 403 && c.detail.code === 'bad-stream-signature' && c.detail.error === 'bad stream signature') || 'closes ' + short(said.closes);
}, test.limit.quick);
test.run('a refusal with Retry-After waits that long before it asks again', 0.2, async function () {
  const said = client([{ ok: false, status: 503, headers: { get: function (h) { return h === 'retry-after' ? '5' : null; } }, text: function () { return Promise.resolve(''); } }]);
  await settle();
  return (said.timers[0] || {}).ms === 5000 || 'waits ' + short(said.timers.map(function (t) { return t.ms; }));
}, test.limit.quick);
test.run('a 429 with no Retry-After waits at least twenty seconds', 0.2, async function () {
  const said = client([{ ok: false, status: 429, headers: { get: function () { return null; } }, text: function () { return Promise.resolve(''); } }]);
  await settle();
  return (said.timers[0] || {}).ms >= 20000 || 'waits ' + short(said.timers.map(function (t) { return t.ms; }));
}, test.limit.quick);
test.run('a fetch that throws is said as unreachable, and asked again', 0.2, async function () {
  const said = client([function () { return Promise.reject(new Error('ECONNREFUSED')); }]);
  await settle();
  return (/^unreachable: ECONNREFUSED/.test((said.closes[0] || {}).reason) && said.timers.length === 1) || 'closes ' + short(said.closes);
}, test.limit.quick);

// ── the backoff, clingy and capped ──
test.run('each failed attempt doubles the wait, capped at eight seconds', 0.2, async function () {
  const said = client([function () { return Promise.reject(new Error('down')); }]);
  for (let i = 0; i < 5; i++) { await settle(); const t = said.timers[i]; if (t) t.fn(); }
  await settle();
  const waits = said.timers.map(function (t) { return t.ms; }).slice(0, 5);
  return JSON.stringify(waits) === JSON.stringify([1000, 2000, 4000, 8000, 8000]) || 'waits ' + short(waits);
}, test.limit.quick);
test.run('the wait is spread by its randomness, between half and all of it', 0.2, async function () {
  const said = client([function () { return Promise.reject(new Error('down')); }], { randomImpl: function () { return 0; } });
  await settle();
  return (said.timers[0] || {}).ms === 500 || 'the first wait with randomness 0: ' + short(said.timers.map(function (t) { return t.ms; }));
}, test.limit.quick);
test.run('bytes read set the wait back to the first', 0.2, async function () {
  const said = client([function () { return Promise.reject(new Error('down')); }, streamed(['event: x\ndata: 1\n\n'])]);
  await settle(); said.timers[0].fn(); await settle();
  const waits = said.timers.map(function (t) { return t.ms; });
  return (waits[0] === 1000 && waits[1] === 1000) || 'waits ' + short(waits);
}, test.limit.quick);

// ── idle, and close ──
test.run('silence past its idle wait aborts the stream, which is said and asked again', 0.2, async function () {
  let idle = null;
  // A held stream that errors when its fetch is aborted, as a real fetch's body does.
  const held = { fetchImpl: function (url, init) {
    const enc = new TextEncoder();
    return Promise.resolve({ ok: true, status: 200, body: new ReadableStream({ start: function (c) {
      c.enqueue(enc.encode('event: x\ndata: 1\n\n'));
      if (init && init.signal) init.signal.addEventListener('abort', function () { c.error(new Error('aborted')); });
    } }) });
  }, idleTimeoutImpl: function (fn) { idle = fn; return 1; } };
  const said = client([], held);
  await settle();
  if (typeof idle !== 'function') return 'no idle wait was set';
  idle();
  await settle();
  return (said.closes.length === 1 && /read failed|ended/.test(said.closes[0].reason) && said.timers.length === 1) || 'closes ' + short(said.closes) + ', timers ' + said.timers.length;
}, test.limit.quick);
test.run('close stops it: a retry already due fetches nothing more', 0.2, async function () {
  const said = client([function () { return Promise.reject(new Error('down')); }]);
  await settle();
  said.client.close();
  const before = said.fetched.length;
  if (said.timers[0]) said.timers[0].fn();
  await settle();
  return said.fetched.length === before || 'fetched ' + (said.fetched.length - before) + ' more after close';
}, test.limit.quick);
