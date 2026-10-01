'use strict';

// fileTransfer goal/G1.2: the transfer itself — the receiver pulls the file stretch by stretch.
// Red on today's tree: fetch answers but transfers nothing ("fetching from a peer is not built yet").
//   Andy: "the fileServers will autonomously execute (unless interrupted), where the client must
//   request subsets of the file, because our auth-scheme will only facilitate that direction."
//   The no-rush scheme: "agreed. scheme approved." and "same for responses." A turn is an attempt:
//   "wsl. true. i revise my opinion. it's attempts only." Chunks: "now the format of the chunks:
//   base64?" — base64 in the reply's data, about 6 KB of file inside ANSWER_MAX.
//   Resume: the receiver's own <start>-<length>.blob names are the resume state; the provider keeps
//   no transfer state. Integrity: the hash the receiver asked for is the checksum; a match is one
//   rename to complete.blob. Give-up: "how long a download may keep failing before it stops; 5
//   minutes." — asserted here as the constant, since no red waits five minutes.
// The world this red builds: a REAL provider fileServer on its own pipe, a REAL receiver fileServer
// on another, and between them a pretend node (the receiver's SPIRIT_CALLBACK_URL): every peer.post
// the receiver sends is routed into the provider's pipe as a member's ask and the answer returns by
// re on the event stream — so fetch, info, chunking, parts, resume, pause, progress and the final
// rename run on real files over the real shapes.
// Shapes this red fixes, argued in goal/G1.2 before building:
//   1. fetch { id, from } answers { id } at once; the transfer runs on after it.
//   2. The receiver asks { fileServer: { <id>: { command, data } } } through spirit.peerPost with
//      kind background, ONE outstanding chunk-request at a time, round-robin over live downloads.
//   3. chunk answers { command: 'chunk', data: <the bytes, base64> }; the provider's hash-verb
//      answers (info and chunk alike) are marked background — "same for responses."
//   4. pause and resume are owner-only commands on the RECEIVER's own verb-<id>, refused to members.
//   5. Progress: one publish per change, { transfer: { id, name, held, bytes, state } }, state
//      fetching, paused, stopped or complete.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by fileTransfer goal/G1.2: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'fileServer', 'fileServer.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function until(fn, ms) { const end = Date.now() + ms; for (;;) { const v = fn(); if (v || Date.now() > end) return v; await sleep(100); } }

test.startTest('fileTransfer goal/G1.2: the receiver pulls the file stretch by stretch');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-filefetch-'));
const kids = [];
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAfileFetchOwnerAAAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const MEMBER = { key: 'MCowBQYDK2VwAyEAfileFetchPeerAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'bert' };
const PROVIDER_KEY = 'MCowBQYDK2VwAyEAfileFetchProviderAAAAAAAAAAAAAAAAAAAA=';

function clientFor(name, pipe) {
  const c = appClient.createAppClient({ rootDir: scratch });
  c.register('fileServer', pipe);
  return function (verb, args, caller) { const b = {}; b[verb] = args; return c.ask({ fileServer: b }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
}
function startServer(tag, pipe, state, env) {
  fs.mkdirSync(state, { recursive: true });
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state],
    { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: Object.assign({}, process.env, env || {}) });
  kids.push(kid);
  return kid;
}
async function served(call) {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    const r = await call('status', { hash: 'verb-' + 'A'.repeat(43) }, ANDY);
    if (r.status) return true;
  }
  return false;
}

// Two source files, enough for several ~6 KB chunks each.
function bytesOf(seed, n) { const b = Buffer.alloc(n); for (let i = 0; i < n; i++) b[i] = (i * seed + seed) % 256; return b; }
const srcA = path.join(scratch, 'alpha.bin'); fs.writeFileSync(srcA, bytesOf(7, 20000));
const srcB = path.join(scratch, 'beta.bin'); fs.writeFileSync(srcB, bytesOf(11, 15000));

// Windows listens on named pipes only, as fileCap.js does: pipePathFor there, a socket file elsewhere.
const pipeFor = function (name) { return process.platform === 'win32' ? appClient.pipePathFor(scratch, name, 'win32', 'process') : path.join(scratch, name + '.sock'); };
const providerPipe = pipeFor('prov');
const providerState = path.join(scratch, 'prov-state');
const receiverPipe = pipeFor('recv');
const receiverState = path.join(scratch, 'recv-state');

// ── THE PRETEND NODE: the receiver's one door to its peer ─────────────
const posts = [];      // every peer.post: { to, id, command, data, kind }
const transfers = [];  // every progress row the receiver published
let inFlight = 0;
let maxInFlight = 0;
const streams = [];
const node = http.createServer(function (req, res) {
  if (req.method === 'GET' && req.url === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(': open\n\n');
    streams.push(res);
    return;
  }
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    if (b.verb === 'jobs.update') {
      if (b.app && b.app.transfer) transfers.push(b.app.transfer);
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      return;
    }
    if (b.verb !== 'peer.post') { res.writeHead(400); res.end('{"ok":false}'); return; }
    inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight);
    const hash = 'H' + posts.length;
    let ask = null;
    try { ask = packet.decode(b.text); } catch (e) { ask = null; }
    const body = (ask && ask.body && ask.body.fileServer) || {};
    const id = Object.keys(body)[0] || '';
    const inner = body[id] || {};
    posts.push({ to: b.to, id: id, command: inner.command, data: inner.data, kind: b.kind });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hash: hash }));
    const answerWith = function (answerBody) {
      inFlight -= 1;
      const made = packet.encode('api', answerBody, { re: hash });
      streams.forEach(function (s) { try { s.write('event: packet\ndata: ' + JSON.stringify({ from: b.to, text: made.text }) + '\n\n'); } catch (e) { /* gone */ } });
    };
    const one = {}; one[id] = inner;
    providerAsk({ fileServer: one }, MEMBER).then(function (r) { answerWith(r && r.body); },
      function () { answerWith({ ok: false, code: 'handler-failed', error: 'the pretend node tripped' }); });
  });
});
let providerAsk = null;

async function main() {
  if (!fs.existsSync(SERVER)) { test.fail(OWED + 'no fileServer at all'); return; }
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  const nodeUrl = 'http://127.0.0.1:' + node.address().port;

  startServer('prov', providerPipe, providerState);
  const prov = clientFor('prov', providerPipe);
  const provClient = appClient.createAppClient({ rootDir: scratch });
  provClient.register('fileServer', providerPipe);
  providerAsk = function (body, caller) { return provClient.ask(body, caller); };
  if (!await served(prov)) { test.fail(OWED + 'the provider never served'); return; }
  const idA = ((await prov('push', { path: srcA }, ANDY)).body || {}).hash;
  const idB = ((await prov('push', { path: srcB }, ANDY)).body || {}).hash;
  if (!idA || !idB) { test.fail(OWED + 'the provider would not take the sources'); return; }

  startServer('recv', receiverPipe, receiverState, { SPIRIT_CALLBACK_URL: nodeUrl + '/cb', SPIRIT_JOB_ID: 'filefetch-red' });
  const recv = clientFor('recv', receiverPipe);
  if (!await served(recv)) { test.fail(OWED + 'the receiver never served'); return; }

  test.subHeading('the provider\'s answers say no-rush themselves');
  const info = await providerAsk({ fileServer: { [idA]: { command: 'info', data: '' } } }, MEMBER);
  if (info.status === 200 && info.kind === 'background') test.check('an info answer is marked background — "same for responses"');
  else test.fail(OWED + 'info answered ' + info.status + ' kind ' + JSON.stringify(info.kind));
  const slice = await providerAsk({ fileServer: { [idA]: { command: 'chunk', data: '{"start":100,"length":600}' } } }, MEMBER);
  const want = bytesOf(7, 20000).slice(100, 700).toString('base64');
  if (slice.status === 200 && slice.body && slice.body.command === 'chunk' && slice.body.data === want && slice.kind === 'background') {
    test.check('chunk answers exactly the asked bytes, base64 in data, marked background');
  } else test.fail(OWED + 'chunk answered ' + slice.status + ' ' + JSON.stringify(slice.body && (slice.body.code || (slice.body.data || '').length)));

  test.subHeading('fetch pulls the whole file, one request at a time, all no-rush');
  const fetched = await recv('fetch', { id: idA, from: PROVIDER_KEY }, ANDY);
  if (fetched.status === 200 && fetched.body && fetched.body.id === idA) test.check('fetch answers its id at once and works on');
  else { test.fail(OWED + 'fetch answered ' + fetched.status + ' ' + JSON.stringify(fetched.body)); return; }
  const doneA = await until(function () { return fs.existsSync(path.join(receiverState, idA, 'complete.blob')); }, 30000);
  if (doneA && fs.readFileSync(path.join(receiverState, idA, 'complete.blob')).equals(bytesOf(7, 20000))) {
    test.check('the file arrived whole, bytes for bytes, renamed to complete.blob');
  } else test.fail(OWED + 'the transfer never completed (' + posts.length + ' asks made)');
  const st = ((await recv('status', { hash: idA }, ANDY)).body) || {};
  if (st.bytes === 20000 && Array.isArray(st.names) && st.names.indexOf('alpha.bin') !== -1) {
    test.check('the info-call\'s answer landed in the receiver\'s fileStatus.json');
  } else test.fail(OWED + 'the receiver\'s status says ' + JSON.stringify(st));
  const chunkAsks = posts.filter(function (p) { return p.command === 'chunk'; });
  if (posts.length && posts.every(function (p) { return p.kind === 'background'; }) && maxInFlight === 1
    && chunkAsks.every(function (p) { let d = {}; try { d = JSON.parse(p.data); } catch (e) { d = {}; } return d.length > 0 && d.length <= 6200; })) {
    test.check(posts.length + ' asks, every one background, never two in flight, chunks at most ~6 KB');
  } else test.fail(OWED + 'asks: ' + posts.length + ', maxInFlight ' + maxInFlight + ', kinds ' + JSON.stringify(posts.slice(0, 3).map(function (p) { return p.kind; })));

  test.subHeading('a second download shares the wheel, turn and turn about');
  await recv('fetch', { id: idB, from: PROVIDER_KEY }, ANDY);
  const doneB = await until(function () { return fs.existsSync(path.join(receiverState, idB, 'complete.blob')); }, 30000);
  if (doneB && fs.readFileSync(path.join(receiverState, idB, 'complete.blob')).equals(bytesOf(11, 15000))) test.check('the second file arrived whole too');
  else test.fail(OWED + 'the second transfer never completed');

  test.subHeading('resume: the parts on disk are the only state');
  // A third file, pre-seeded as a half-done download in the receiver's store: fetch must ask only
  // for what is missing and finish from the parts.
  const srcC = path.join(scratch, 'gamma.bin'); fs.writeFileSync(srcC, bytesOf(13, 12000));
  const idC = ((await prov('push', { path: srcC }, ANDY)).body || {}).hash;
  const cDir = path.join(receiverState, idC);
  fs.mkdirSync(cDir, { recursive: true });
  fs.writeFileSync(path.join(cDir, '0-6000.blob'), bytesOf(13, 12000).slice(0, 6000));
  fs.writeFileSync(path.join(cDir, 'fileStatus.json'), JSON.stringify({ hash: idC, bytes: 12000, mime: 'application/octet-stream', names: ['gamma.bin'], at: new Date().toISOString() }));
  const seen = posts.length;
  await recv('fetch', { id: idC, from: PROVIDER_KEY }, ANDY);
  const doneC = await until(function () { return fs.existsSync(path.join(cDir, 'complete.blob')); }, 30000);
  const cAsks = posts.slice(seen).filter(function (p) { return p.id === idC && p.command === 'chunk'; });
  const askedHeld = cAsks.some(function (p) { let d = {}; try { d = JSON.parse(p.data); } catch (e) { d = {}; } return d.start < 6000; });
  if (doneC && fs.readFileSync(path.join(cDir, 'complete.blob')).equals(bytesOf(13, 12000)) && !askedHeld) {
    test.check('fetch finished from the parts and never asked for bytes already held');
  } else test.fail(OWED + (doneC ? 'a held stretch was asked for again' : 'the resume never completed') + ' (' + cAsks.length + ' chunk asks)');

  test.subHeading('progress says what changed, and pause is the owner\'s');
  const states = transfers.filter(function (t) { return t.id === idA; }).map(function (t) { return t.state; });
  const rows = transfers.filter(function (t) { return t.id === idA; });
  if (rows.length >= 2 && states.indexOf('fetching') !== -1 && states[states.length - 1] === 'complete'
    && rows.every(function (t) { return t.name === 'alpha.bin' && t.bytes === 20000 && typeof t.held === 'number'; })) {
    test.check('rows {transfer: {id, name, held, bytes, state}} rode each change, fetching through complete');
  } else test.fail(OWED + 'the progress rows say ' + JSON.stringify(rows.slice(0, 3)) + ' … ' + JSON.stringify(states.slice(-2)));
  const pausedAsMember = await recv(idA, { command: 'pause', data: '' }, MEMBER);
  if (pausedAsMember.status !== 200 && pausedAsMember.body && pausedAsMember.body.code === 'not-owner') {
    test.check('pause on the receiver\'s own verb is refused to a member');
  } else test.fail(OWED + 'a member\'s pause answered ' + pausedAsMember.status + ' ' + JSON.stringify(pausedAsMember.body));

  test.subHeading('the give-up is Andy\'s five minutes');
  const src = fs.readFileSync(SERVER, 'utf8');
  if (/5 \* 60 \* 1000|300000|300 \* 1000/.test(src)) test.check('the stop-after-failing constant is 5 minutes');
  else test.fail(OWED + 'no 5-minute constant in fileServer.js — "how long a download may keep failing before it stops; 5 minutes."');
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.message)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  streams.forEach(function (s) { try { s.end(); } catch (e) { /* gone */ } });
  try { node.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
});
