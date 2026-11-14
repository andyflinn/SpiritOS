'use strict';

// spirit/run/spirit/test/relayRequest.js
// The tests of spirit/relayRequest.js, and of no other module (spec: ./relayRequest.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// The one outbound door onto a public relay (relayRequest, relayUpload) and the owner node's one hop to an app server on
// its own box (pipeRequest). Every socket here is local: an http server planted on 127.0.0.1 port 0 stands for the relay,
// one on the pipe appClient.pipePathFor names on a scratch root stands for the app server. No public host is reached: an
// address assertRelayUrl refuses is refused before any socket opens, which is counted on http.request and https.request.

const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));
const pipePathFor = require(path.join(RUN, 'spirit', 'appClient.js')).pipePathFor;
const R = require(path.join(RUN, 'spirit', 'relayRequest.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function caught(p) { return p.then(function (v) { return { value: v }; }, function (e) { return { error: e }; }); }
// What each route of the planted server does; every request it took is kept.
function handler(seen) {
  return function (req, res) {
    const chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      const body = Buffer.concat(chunks).toString('utf8');
      seen.push({ method: req.method, url: req.url, headers: req.headers, body: body });
      if (req.url === '/hold') return; // never answers
      if (req.url === '/refuse') { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"code":"no-such"}'); return; }
      if (req.url === '/big') { res.writeHead(200); res.end('x'.repeat(2000)); return; }
      if (req.url === '/huge') { res.writeHead(200); res.end('x'.repeat(limits.BODY_MAX + 1)); return; }
      if (req.url === '/split') { const b = Buffer.from('grüß', 'utf8'); res.writeHead(200); res.write(b.subarray(0, 3)); setTimeout(function () { res.end(b.subarray(3)); }, 30); return; }
      if (req.url === '/dribble') { res.writeHead(200); const t = setInterval(function () { if (!res.writableEnded) res.write('.'); }, 50); res.on('close', function () { clearInterval(t); }); return; }
      if (req.url === '/background') { res.writeHead(200, { 'Content-Type': 'text/plain', 'X-Spirit-Kind': 'background' }); res.end('later'); return; }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('echo ' + req.method + ' ' + req.url + ' ' + body);
    });
  };
}
const W = { relay: null, base: null, seen: [], pipe: null, pipeServer: null, pipeSeen: [], root: null, dead: null };
const NO_RELAY = 'no planted relay: the world failed';
const NO_PIPE = 'no planted app server: the world failed';

// Counting sockets opened: http.request and https.request are what relayRequest's lib.request resolves to at call time.
function counted(fn) {
  let n = 0;
  const h = http.request, s = https.request;
  http.request = function () { n += 1; return h.apply(http, arguments); };
  https.request = function () { n += 1; return s.apply(https, arguments); };
  return Promise.resolve().then(fn).then(function (v) { http.request = h; https.request = s; return { n: n, v: v }; }, function (e) { http.request = h; https.request = s; throw e; });
}

test.run('the world: a planted relay on 127.0.0.1 port 0, an app server on its pipe, and a port nothing listens on', 0.2, async function () {
  W.relay = http.createServer(handler(W.seen));
  await new Promise(function (r) { W.relay.listen(0, '127.0.0.1', r); });
  W.base = 'http://127.0.0.1:' + W.relay.address().port;
  W.root = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-'));
  W.pipe = pipePathFor(W.root, 'reqtest', process.platform);
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(W.pipe), { recursive: true });
  W.pipeServer = http.createServer(handler(W.pipeSeen));
  await new Promise(function (r) { W.pipeServer.listen(W.pipe, r); });
  const probe = http.createServer();
  await new Promise(function (r) { probe.listen(0, '127.0.0.1', r); });
  W.dead = probe.address().port;
  await new Promise(function (r) { probe.close(r); });
  return (!!W.relay.address() && !!W.pipeServer.listening) || 'the planted servers did not listen';
}, test.limit.quick);

// ── relayRequest ──
test.run('relayRequest: the method, the path and the JSON body reach the relay, and the answer is { status, text }', 0.2, async function () {
  if (!W.base) return NO_RELAY;
  const n = W.seen.length;
  const a = await R.relayRequest(W.base, 'POST', '/post?x=1', { hello: 'world' });
  const s = W.seen[n] || {};
  return (a.status === 200 && a.text === 'echo POST /post?x=1 {"hello":"world"}' && s.method === 'POST' && s.url === '/post?x=1' && short(Object.keys(a).sort()) === short(['status', 'text'])) || short({ a: a, s: s });
}, test.limit.quick);
test.run('relayRequest: Host is the target\'s own, set explicitly (server.js checks it), with JSON type and the body\'s length', 0.2, async function () {
  if (!W.base) return NO_RELAY;
  const n = W.seen.length;
  // Explicitly: on loopback Node would write the same Host itself, so the options handed to http.request are read too.
  let given = null;
  const h0 = http.request;
  http.request = function (opts) { given = opts && opts.headers; return h0.apply(http, arguments); };
  try { await R.relayRequest(W.base, 'POST', '/h', { a: 'é' }); } finally { http.request = h0; }
  const h = (W.seen[n] || {}).headers || {};
  const host = '127.0.0.1:' + W.relay.address().port;
  return (given && given.Host === host && h.host === host && h['content-type'] === 'application/json' && h['content-length'] === String(Buffer.byteLength('{"a":"é"}'))) || short({ given: given, wire: h });
}, test.limit.quick);
test.run('relayRequest: the caller\'s extra headers ride along', 0.2, async function () {
  if (!W.base) return NO_RELAY;
  const n = W.seen.length;
  await R.relayRequest(W.base, 'GET', '/x', null, { 'X-Spirit-Sig': 'sig1' });
  const s = W.seen[n] || {};
  return (s.headers && s.headers['x-spirit-sig'] === 'sig1' && s.body === '') || short(s);
}, test.limit.quick);
test.run('relayRequest: a refusal is an answer, never a throw', 0.2, async function () {
  if (!W.base) return NO_RELAY;
  const r = await caught(R.relayRequest(W.base, 'GET', '/refuse'));
  return (r.value && r.value.status === 404 && r.value.text === '{"code":"no-such"}') || short(r.error ? String(r.error.message) : r.value);
}, test.limit.quick);
test.run('relayRequest: a character split across two chunks arrives whole (one reader, bytes decoded once)', 0.2, async function () {
  if (!W.base) return NO_RELAY;
  const a = await R.relayRequest(W.base, 'GET', '/split');
  return a.text === 'grüß' || short(a);
}, test.limit.quick);
test.run('relayRequest: plain http to a host not loopback, a bad address, or another scheme is refused before any socket opens', 0.2, async function () {
  const got = await counted(function () {
    return Promise.all([caught(R.relayRequest('http://example.com', 'GET', '/')), caught(R.relayRequest('ftp://127.0.0.1', 'GET', '/')), caught(R.relayRequest('not a url', 'GET', '/'))]);
  });
  const msgs = got.v.map(function (r) { return r.error ? String(r.error.message) : 'answered'; });
  return (got.n === 0 && /must be https/.test(msgs[0]) && /must be https/.test(msgs[1]) && /bad relay url/.test(msgs[2])) || short({ sockets: got.n, msgs: msgs });
}, test.limit.quick);
test.run('relayRequest: no answer at all rejects (nothing listening)', 0.2, async function () {
  if (!W.dead) return NO_RELAY;
  const r = await caught(R.relayRequest('http://127.0.0.1:' + W.dead, 'GET', '/'));
  return (!!r.error && !r.value) || 'answered ' + short(r.value);
}, test.limit.quick);
test.run('relayRequest: a deadline, said as relay-did-not-answer, for a relay that holds the socket', 0.2, async function () {
  if (!W.base) return NO_RELAY;
  const t = Date.now();
  const r = await caught(R.relayRequest(W.base, 'GET', '/hold', null, null, { timeoutMs: 300 }));
  return (r.error && r.error.code === 'relay-did-not-answer' && Date.now() - t < 3000) || short(r.error ? { code: r.error.code, ms: Date.now() - t } : r.value);
}, test.limit.quick);
test.run('relayRequest: a deadline, not an idle timer: a relay dribbling a byte at a time is cut too', 0.2, async function () {
  if (!W.base) return NO_RELAY;
  const r = await caught(R.relayRequest(W.base, 'GET', '/dribble', null, null, { timeoutMs: 400 }));
  return (r.error && r.error.code === 'relay-did-not-answer') || short(r.error ? r.error.code : r.value);
}, test.limit.quick);
test.run('relayRequest: the deadline is 30 s by default, peerPost\'s public patience', 0.2, function () {
  return R.RELAY_ANSWER_DEADLINE_MS === 30000 || short(R.RELAY_ANSWER_DEADLINE_MS);
}, test.limit.quick);
test.run('relayRequest: an answer past answerMax is refused by name, relay-answer-too-large', 0.2, async function () {
  if (!W.base) return NO_RELAY;
  const r = await caught(R.relayRequest(W.base, 'GET', '/big', null, null, { answerMax: 100 }));
  return (r.error && r.error.code === 'relay-answer-too-large') || short(r.error ? r.error.code : r.value && r.value.text.length);
}, test.limit.quick);
test.run('relayRequest: by default an answer is bounded by limits.BODY_MAX (Andy: "ALWAYS bounded by MAX_PAYLOAD")', 0.2, async function () {
  if (!W.base) return NO_RELAY;
  const over = await caught(R.relayRequest(W.base, 'GET', '/huge'));
  const under = await caught(R.relayRequest(W.base, 'GET', '/big'));
  return (over.error && over.error.code === 'relay-answer-too-large' && under.value && under.value.text.length === 2000) || short({ over: over.error ? over.error.code : 'answered', under: under.error ? under.error.code : 'ok' });
}, test.limit.quick);

// ── pipeRequest ──
test.run('pipeRequest: { status, text, type } from the app server on its pipe, the method upper-cased', 0.2, async function () {
  if (!W.pipeServer) return NO_PIPE;
  const n = W.pipeSeen.length;
  const a = await R.pipeRequest(W.pipe, 'post', '/verb', 'body text', { type: 'text/plain' });
  const s = W.pipeSeen[n] || {};
  return (a.status === 200 && a.text === 'echo POST /verb body text' && a.type === 'text/plain; charset=utf-8' && s.method === 'POST' && a.kind === undefined) || short({ a: a, s: s.method });
}, test.limit.quick);
test.run('pipeRequest: only the content type crosses, Host localhost, no cookie or forwarded address of its own', 0.2, async function () {
  if (!W.pipeServer) return NO_PIPE;
  const n = W.pipeSeen.length;
  await R.pipeRequest(W.pipe, 'POST', '/h', 'x', { type: 'application/json' });
  const h = (W.pipeSeen[n] || {}).headers || {};
  const keys = Object.keys(h).filter(function (k) { return k !== 'connection'; }).sort();
  return (h.host === 'localhost' && h['content-type'] === 'application/json' && short(keys) === short(['content-length', 'content-type', 'host'])) || short(h);
}, test.limit.quick);
test.run('pipeRequest: the caller\'s own headers ride along (apiAuth/G1.13)', 0.2, async function () {
  if (!W.pipeServer) return NO_PIPE;
  const n = W.pipeSeen.length;
  await R.pipeRequest(W.pipe, 'GET', '/h', null, { headers: { 'X-Spirit-Caller': 'k1' } });
  const h = (W.pipeSeen[n] || {}).headers || {};
  return h['x-spirit-caller'] === 'k1' || short(h);
}, test.limit.quick);
test.run('pipeRequest: the server\'s background mark comes back as kind background (fileTransfer goal/G1.3)', 0.2, async function () {
  if (!W.pipeServer) return NO_PIPE;
  const a = await R.pipeRequest(W.pipe, 'GET', '/background');
  return (a.kind === 'background' && a.text === 'later') || short(a);
}, test.limit.quick);
test.run('pipeRequest: nothing on the pipe is refused app-not-running, never a throw', 0.2, async function () {
  if (!W.root) return NO_PIPE;
  const r = await caught(R.pipeRequest(pipePathFor(W.root, 'nobody', process.platform), 'GET', '/'));
  return (r.value && r.value.refused === 'app-not-running') || short(r.error ? String(r.error.message) : r.value);
}, test.limit.quick);
test.run('pipeRequest: an app that does not finish in time is refused app-did-not-answer, dribbling or silent', 0.2, async function () {
  if (!W.pipeServer) return NO_PIPE;
  const got = await Promise.all([caught(R.pipeRequest(W.pipe, 'GET', '/hold', null, { timeoutMs: 300 })), caught(R.pipeRequest(W.pipe, 'GET', '/dribble', null, { timeoutMs: 400 }))]);
  return got.every(function (r) { return r.value && r.value.refused === 'app-did-not-answer'; }) || short(got.map(function (r) { return r.value || String(r.error); }));
}, test.limit.quick);
test.run('pipeRequest: an answer past answerMax is refused app-answer-too-large, with its bytes and the cap', 0.2, async function () {
  if (!W.pipeServer) return NO_PIPE;
  const a = await R.pipeRequest(W.pipe, 'GET', '/big', null, { answerMax: 100 });
  return (a.refused === 'app-answer-too-large' && a.max === 100 && a.bytes > 100) || short(a);
}, test.limit.quick);

// ── relayUpload ──
test.run('relayUpload: a streamed POST, chunked, octet-stream, Host the target\'s, the writes arriving whole', 0.2, async function () {
  if (!W.base) return NO_RELAY;
  const n = W.seen.length;
  const req = R.relayUpload(W.base, '/face/upload', { 'X-Spirit-Sig': 's' });
  const answered = new Promise(function (r) { req.on('response', function (res) { r(res.statusCode); }); req.on('error', function () { r('error'); }); });
  req.write('part one, ');
  await new Promise(function (r) { setTimeout(r, 30); });
  req.end('part two');
  const status = await answered;
  await new Promise(function (r) { setTimeout(r, 30); });
  const s = W.seen[n] || {};
  const h = s.headers || {};
  return (status === 200 && s.method === 'POST' && s.url === '/face/upload' && s.body === 'part one, part two' && h['transfer-encoding'] === 'chunked' &&
    h['content-type'] === 'application/octet-stream' && h.host === '127.0.0.1:' + W.relay.address().port && h['x-spirit-sig'] === 's' && !('content-length' in h)) || short({ status: status, s: s });
}, test.limit.quick);
test.run('relayUpload: an address assertRelayUrl refuses is said on the stream\'s error, and no socket opens', 0.2, async function () {
  const got = await counted(function () {
    const req = R.relayUpload('http://example.com', '/face/upload');
    return new Promise(function (r) { req.on('error', function (e) { r(String(e && e.message)); }); setTimeout(function () { r('no error said'); }, 1000); });
  });
  return (got.n === 0 && /must be https/.test(got.v)) || short(got);
}, test.limit.quick);

test.run('the world ends: the planted servers close and the scratch root is removed', 0.2, async function () {
  await Promise.all([W.relay, W.pipeServer].filter(Boolean).map(function (s) { if (s.closeAllConnections) s.closeAllConnections(); return new Promise(function (r) { s.close(function () { r(); }); }); }));
  if (W.root) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(W);
  return !(W.root && fs.existsSync(W.root)) || 'scratch root left';
}, test.limit.quick);
