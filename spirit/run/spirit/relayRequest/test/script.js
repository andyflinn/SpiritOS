'use strict';

// spirit/run/spirit/relayRequest/test/script.js
// The tests of spirit/relayRequest/script.js, and of no other module (spec: ./script.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// The one outbound door onto a public relay (relayRequest, relayUpload) and the owner node's one hop to an app server on
// its own box (pipeRequest). Every socket here is local: an http server planted on 127.0.0.1 port 0 stands for the relay,
// one on the pipe appClient.pipePathFor names on a scratch root stands for the app server. No public host is reached: an
// address assertRelayUrl refuses is refused before any socket opens, which is counted on http.request and https.request.

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../../tempFolder/script.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/relayRequest/' + name + tempAsked); }
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/test/relayRequest'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const limits = S.requireScript('spirit/limits/script.js');
const pipePathFor = S.requireScript('spirit/appClient/script.js').pipePathFor;
const R = S.requireScript('spirit/relayRequest/script.js');

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

// Counting sockets opened: http.request and https.request are what relayRequest's lib.request resolves to at call time.
function counted(fn) {
  let n = 0;
  const h = http.request, s = https.request;
  http.request = function () { n += 1; return h.apply(http, arguments); };
  https.request = function () { n += 1; return s.apply(https, arguments); };
  return Promise.resolve().then(fn).then(function (v) { http.request = h; https.request = s; return { n: n, v: v }; }, function (e) { http.request = h; https.request = s; throw e; });
}

test.run('a relay is planted on 127.0.0.1 port 0, with an app server on its pipe and a port nothing listens on', 0.2, async function () {
  W.relay = http.createServer(handler(W.seen));
  await new Promise(function (r) { W.relay.listen(0, '127.0.0.1', r); });
  W.base = 'http://127.0.0.1:' + W.relay.address().port;
  W.root = ownTemp('rr-');
  W.pipe = pipePathFor(W.root, 'reqtest', process.platform);
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(W.pipe), { recursive: true });
  W.pipeServer = http.createServer(handler(W.pipeSeen));
  await new Promise(function (r) { W.pipeServer.listen(W.pipe, r); });
  const probe = http.createServer();
  await new Promise(function (r) { probe.listen(0, '127.0.0.1', r); });
  W.dead = probe.address().port;
  await new Promise(function (r) { probe.close(r); });
  return (!!W.relay.address() && !!W.pipeServer.listening) || false;
}, test.limit.quick);

// ── relayRequest ──
test.run('relayRequest brings the method, the path and the JSON body to the relay, and answers its status and text', 0.2, async function () {
  if (!W.base) return false;
  const n = W.seen.length;
  const a = await R.relayRequest(W.base, 'POST', '/post?x=1', { hello: 'world' });
  const s = W.seen[n] || {};
  return (a.status === 200 && a.text === 'echo POST /post?x=1 {"hello":"world"}' && s.method === 'POST' && s.url === '/post?x=1' && short(Object.keys(a).sort()) === short(['status', 'text'])) || false;
}, test.limit.quick);
test.run('relayRequest sets the Host header to the target\'s own, as server.js checks it, with the JSON type and the body\'s length', 0.2, async function () {
  if (!W.base) return false;
  const n = W.seen.length;
  // Explicitly: on loopback Node would write the same Host itself, so the options handed to http.request are read too.
  let given = null;
  const h0 = http.request;
  http.request = function (opts) { given = opts && opts.headers; return h0.apply(http, arguments); };
  try { await R.relayRequest(W.base, 'POST', '/h', { a: 'é' }); } finally { http.request = h0; }
  const h = (W.seen[n] || {}).headers || {};
  const host = '127.0.0.1:' + W.relay.address().port;
  return (given && given.Host === host && h.host === host && h['content-type'] === 'application/json' && h['content-length'] === String(Buffer.byteLength('{"a":"é"}'))) || false;
}, test.limit.quick);
test.run('relayRequest carries the caller\'s extra headers along', 0.2, async function () {
  if (!W.base) return false;
  const n = W.seen.length;
  await R.relayRequest(W.base, 'GET', '/x', null, { 'X-Spirit-Sig': 'sig1' });
  const s = W.seen[n] || {};
  return (s.headers && s.headers['x-spirit-sig'] === 'sig1' && s.body === '') || false;
}, test.limit.quick);
test.run('relayRequest answers a refusal and never throws it', 0.2, async function () {
  if (!W.base) return false;
  const r = await caught(R.relayRequest(W.base, 'GET', '/refuse'));
  return (r.value && r.value.status === 404 && r.value.text === '{"code":"no-such"}') || false;
}, test.limit.quick);
test.run('relayRequest delivers a character split across two chunks whole, because one reader decodes the bytes once', 0.2, async function () {
  if (!W.base) return false;
  const a = await R.relayRequest(W.base, 'GET', '/split');
  return a.text === 'grüß' || false;
}, test.limit.quick);
test.run('relayRequest refuses plain http to a host that is not loopback, a bad address, or another scheme before any socket opens', 0.2, async function () {
  const got = await counted(function () {
    return Promise.all([caught(R.relayRequest('http://example.com', 'GET', '/')), caught(R.relayRequest('ftp://127.0.0.1', 'GET', '/')), caught(R.relayRequest('not a url', 'GET', '/'))]);
  });
  const msgs = got.v.map(function (r) { return r.error ? String(r.error.message) : ''; });
  return (got.n === 0 && /must be https/.test(msgs[0]) && /must be https/.test(msgs[1]) && /bad relay url/.test(msgs[2])) || false;
}, test.limit.quick);
test.run('relayRequest rejects when there is no answer at all because nothing is listening', 0.2, async function () {
  if (!W.dead) return false;
  const r = await caught(R.relayRequest('http://127.0.0.1:' + W.dead, 'GET', '/'));
  return (!!r.error && !r.value) || false;
}, test.limit.quick);
test.run('relayRequest has a deadline for a relay that holds the socket, said as relay-did-not-answer', 0.2, async function () {
  if (!W.base) return false;
  const t = Date.now();
  const r = await caught(R.relayRequest(W.base, 'GET', '/hold', null, null, { timeoutMs: 300 }));
  return (r.error && r.error.code === 'relay-did-not-answer' && Date.now() - t < 3000) || false;
}, test.limit.quick);
test.run('relayRequest has a deadline, not an idle timer, so a relay dribbling a byte at a time is cut too', 0.2, async function () {
  if (!W.base) return false;
  const r = await caught(R.relayRequest(W.base, 'GET', '/dribble', null, null, { timeoutMs: 400 }));
  return (r.error && r.error.code === 'relay-did-not-answer') || false;
}, test.limit.quick);
test.run('the deadline of relayRequest is 30 s by default, peerPost\'s public patience', 0.2, function () {
  return R.RELAY_ANSWER_DEADLINE_MS === 30000 || false;
}, test.limit.quick);
test.run('relayRequest refuses an answer past answerMax by name, relay-answer-too-large', 0.2, async function () {
  if (!W.base) return false;
  const r = await caught(R.relayRequest(W.base, 'GET', '/big', null, null, { answerMax: 100 }));
  return (r.error && r.error.code === 'relay-answer-too-large') || false;
}, test.limit.quick);
test.run('relayRequest bounds an answer by limits.BODY_MAX by default', 0.2, async function () {
  if (!W.base) return false;
  const over = await caught(R.relayRequest(W.base, 'GET', '/huge'));
  const under = await caught(R.relayRequest(W.base, 'GET', '/big'));
  return (over.error && over.error.code === 'relay-answer-too-large' && under.value && under.value.text.length === 2000) || false;
}, test.limit.quick);

// ── pipeRequest ──
test.run('pipeRequest answers the status, text and type from the app server on its pipe, the method upper-cased', 0.2, async function () {
  if (!W.pipeServer) return false;
  const n = W.pipeSeen.length;
  const a = await R.pipeRequest(W.pipe, 'post', '/verb', 'body text', { type: 'text/plain' });
  const s = W.pipeSeen[n] || {};
  return (a.status === 200 && a.text === 'echo POST /verb body text' && a.type === 'text/plain; charset=utf-8' && s.method === 'POST' && a.kind === undefined) || false;
}, test.limit.quick);
test.run('pipeRequest lets only the content type cross, with Host localhost and no cookie or forwarded address of its own', 0.2, async function () {
  if (!W.pipeServer) return false;
  const n = W.pipeSeen.length;
  await R.pipeRequest(W.pipe, 'POST', '/h', 'x', { type: 'application/json' });
  const h = (W.pipeSeen[n] || {}).headers || {};
  const keys = Object.keys(h).filter(function (k) { return k !== 'connection'; }).sort();
  return (h.host === 'localhost' && h['content-type'] === 'application/json' && short(keys) === short(['content-length', 'content-type', 'host'])) || false;
}, test.limit.quick);
test.run('pipeRequest carries the caller\'s own headers along', 0.2, async function () {
  if (!W.pipeServer) return false;
  const n = W.pipeSeen.length;
  await R.pipeRequest(W.pipe, 'GET', '/h', null, { headers: { 'X-Spirit-Caller': 'k1' } });
  const h = (W.pipeSeen[n] || {}).headers || {};
  return h['x-spirit-caller'] === 'k1' || false;
}, test.limit.quick);
test.run('pipeRequest hands the server\'s background mark back as the kind background', 0.2, async function () {
  if (!W.pipeServer) return false;
  const a = await R.pipeRequest(W.pipe, 'GET', '/background');
  return (a.kind === 'background' && a.text === 'later') || false;
}, test.limit.quick);
test.run('pipeRequest refuses a pipe with nothing on it as app-not-running, and never throws', 0.2, async function () {
  if (!W.root) return false;
  const r = await caught(R.pipeRequest(pipePathFor(W.root, 'nobody', process.platform), 'GET', '/'));
  return (r.value && r.value.refused === 'app-not-running') || false;
}, test.limit.quick);
test.run('pipeRequest refuses an app that does not finish in time as app-did-not-answer, whether it dribbles or stays silent', 0.2, async function () {
  if (!W.pipeServer) return false;
  const got = await Promise.all([caught(R.pipeRequest(W.pipe, 'GET', '/hold', null, { timeoutMs: 300 })), caught(R.pipeRequest(W.pipe, 'GET', '/dribble', null, { timeoutMs: 400 }))]);
  return got.every(function (r) { return r.value && r.value.refused === 'app-did-not-answer'; }) || false;
}, test.limit.quick);
test.run('pipeRequest refuses an answer past answerMax as app-answer-too-large, with its bytes and the cap', 0.2, async function () {
  if (!W.pipeServer) return false;
  const a = await R.pipeRequest(W.pipe, 'GET', '/big', null, { answerMax: 100 });
  return (a.refused === 'app-answer-too-large' && a.max === 100 && a.bytes > 100) || false;
}, test.limit.quick);

// ── relayUpload ──
test.run('relayUpload sends a streamed POST, chunked, as octet-stream, with Host the target\'s, and the writes arrive whole', 0.2, async function () {
  if (!W.base) return false;
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
    h['content-type'] === 'application/octet-stream' && h.host === '127.0.0.1:' + W.relay.address().port && h['x-spirit-sig'] === 's' && !('content-length' in h)) || false;
}, test.limit.quick);
test.run('relayUpload says an address assertRelayUrl refuses on the stream\'s error, and no socket opens', 0.2, async function () {
  const got = await counted(function () {
    const req = R.relayUpload('http://example.com', '/face/upload');
    return new Promise(function (r) { req.on('error', function (e) { r(String(e && e.message)); }); setTimeout(function () { r(''); }, 1000); });
  });
  return (got.n === 0 && /must be https/.test(got.v)) || false;
}, test.limit.quick);

test.run('at the end the planted servers close and the scratch root is removed', 0.2, async function () {
  await Promise.all([W.relay, W.pipeServer].filter(Boolean).map(function (s) { if (s.closeAllConnections) s.closeAllConnections(); return new Promise(function (r) { s.close(function () { r(); }); }); }));
  if (W.root) S.requireScript('spirit/test/headLessChrome.js').freeTree(W);
  return !(W.root && fs.existsSync(W.root)) || false;
}, test.limit.quick);
