'use strict';

// spirit/test/faceStream.js
// goal/G30.14, step 1 of goal/G30.10: the two relay additions, each approved by Andy (Q1, Q2, 2026-10-21). Red on
// today's tree; claude-windows writes it and builds it (one agent). The box, in short:
//   - The face request as a stream event: a request from the logged-in face goes into the member's stream as an event
//     (no route, no in-flight slot), carrying an id.
//   - faceStream: node-internal, the owner's node to the owner's face, the relay only shovelling bytes both ways. No
//     post limit and no size cap. The home node answers a request by an upload tagged with its id, which the relay
//     pipes straight into the waiting face request; a file is its raw data. The live updates are one long-running
//     upload, piped into the face's stream the same way.
//   - The relay neither seals nor opens faceStream. The face opens its own stream to the relay, tied to its login.
// NAMED HERE where the box names none:
//   - relayAuth.faceMessage(key, relayKey, id, atMs) and faceSignatureOk(publicKey, key, relayKey, id, sig, atMs): the
//     home node's signature over an upload, naming this relay and the request id ('stream' for the live updates), a
//     minute either way as a stream signature has.
//   - relay.faceCall(sid, request, sink) -> { ok, status, id }: a 'face' event { id, request } on the member's stream;
//     the face's response (sink) waits for the answer. Refused 401 without a login, 503 with the home node absent.
//   - relay.faceAnswer(key, id, sig, source, meta) -> { ok, status }: meta { status, type }; the relay writes the head
//     and pipes source into the waiting sink. 403 for a bad signature, 404 for an id this member was not asked.
//   - relay.faceOpen(sid, sink) -> { ok }: the face's own stream; the home node gets a 'face-open' event, and
//     'face-close' when the face's stream ends. relay.faceFeed(key, sig, source) pipes the home node's long upload into
//     the face's open stream; 409 when no face stream is open.
//   - relayServer: on a face host, POST /face/call, GET /face/file, GET /face/stream (by the login cookie); for the home
//     node, POST /api/relay/face/answer and POST /api/relay/face/stream, signed in the header x-spirit-sig.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { PassThrough } = require('stream');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.14: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
function settle() { return new Promise(function (r) { setTimeout(r, 10); }); }
const homes = [];

test.startTest('goal/G30.14: the face request as a stream event, and faceStream');

const auth = require('../run/spirit/relayAuth');
const plant = require('./plantIdentity.js');
const relayStore = require('../run/spirit/relayStore');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'g3014-'));
homes.push(home);
plant.ensureAt(home, 'relay');
auth.writeOwner(home, auth.generateIdentity('andy').publicKey);
const bert = auth.generateIdentity('bert');
fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
fs.writeFileSync(path.join(home, 'relay-state', 'face.json'), JSON.stringify({ domain: 'relay.example' }));
const mails = [];
let now = Date.now();
const box = require('../run/spirit/relay').createRelay(home, { now: function () { return now; }, sendMail: function (m) { mails.push(m); return Promise.resolve({ ok: true }); } });
const has = function (fn) { return typeof box[fn] === 'function'; };
const relayKey = box.relayPublicKey();

// Bert: seated with a verified email (the join loop), a face name, his node's stream open and every event it gets kept.
const events = [];
let sid = '';
try {
  box.join(bert.publicKey, 'bert@example.org', 4242, '');
  box.joinConfirm(bert.publicKey, ((/\?join=([A-Za-z0-9_-]+)/.exec((mails[0] || {}).text || '')) || [])[1] || '', '');
  relayStore.open(home).members.setFace(bert.publicKey, 'harbour', 'bert@example.org');
  box.streamOpen(bert.publicKey, auth.sign(bert.privateKey, auth.streamMessage(bert.publicKey, relayKey)), {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (ev) { let d = null; try { d = JSON.parse(da ? da[1] : 'null'); } catch (e) { d = null; } events.push({ event: ev[1], data: d }); }
    },
    end: function () {},
  });
  now += 2 * 60 * 1000;
  box.faceLogin('harbour', 'bert@example.org');
  const token = ((/\?([A-Za-z0-9_-]{16,})/.exec((mails[mails.length - 1] || {}).text || '')) || [])[1] || '';
  sid = (box.faceLogin('harbour', token) || {}).session || '';
} catch (e) { /* the checks say what is missing */ }

function sink() {
  const s = new PassThrough();
  s.head = null;
  s.writeHead = function (status, headers) { s.head = { status: status, headers: headers || {} }; return s; };
  s.text = '';
  s.on('data', function (c) { s.text += c.toString('utf8'); });
  return s;
}
function signFor(id) { return has('faceCall') && typeof auth.faceMessage === 'function' ? auth.sign(bert.privateKey, auth.faceMessage(bert.publicKey, relayKey, id)) : ''; }

const done = (async function () {
  test.subHeading('1. a face request is an event on the member\'s stream');
  let call = null;
  const waiting = sink();
  try { call = has('faceCall') ? box.faceCall(sid, { verb: 'node.card' }, waiting) : null; } catch (e) { call = { threw: e.message }; }
  const sent = events.filter(function (e) { return e.event === 'face'; }).pop();
  if (call && call.ok && call.id && sent && sent.data && sent.data.id === call.id && sent.data.request && sent.data.request.verb === 'node.card')
    test.check('faceCall puts a face event { id, request } on bert\'s stream and holds the face\'s response');
  else test.fail(OWED + 'faceCall answered ' + short(call) + ', the stream got ' + short(sent));
  let nobody = null;
  try { nobody = has('faceCall') ? box.faceCall('not-a-session', { verb: 'node.card' }, sink()) : null; } catch (e) { nobody = { threw: e.message }; }
  if (nobody && nobody.ok === false && nobody.status === 401) test.check('without a login the face request is refused, 401');
  else test.fail(OWED + 'a face request without a login answered ' + short(nobody));

  test.subHeading('2. the home node\'s upload is piped into the waiting response, whole');
  let answered = null;
  const upload = new PassThrough();
  const id = call && call.id;
  try {
    answered = has('faceAnswer') ? box.faceAnswer(bert.publicKey, id, signFor(id), upload, { status: 200, type: 'application/octet-stream' }) : null;
    const big = Buffer.alloc(300 * 1024, 7); // larger than any post may be: no size cap
    upload.write(big.subarray(0, 100000));
    upload.end(big.subarray(100000));
  } catch (e) { answered = { threw: e.message }; }
  await settle(); await settle();
  if (answered && answered.ok && waiting.head && waiting.head.status === 200 && waiting.text.length === 300 * 1024)
    test.check('faceAnswer pipes 300 KB into the face\'s response, past the post limit, with the head the home node gave');
  else test.fail(OWED + 'faceAnswer answered ' + short(answered) + ', the face got ' + short({ head: waiting.head, bytes: waiting.text.length }));
  let forged = null;
  let unknown = null;
  try {
    const other = auth.generateIdentity('mallory');
    const c2 = has('faceCall') ? box.faceCall(sid, { verb: 'x' }, sink()) : {};
    forged = has('faceAnswer') ? box.faceAnswer(bert.publicKey, c2.id, typeof auth.faceMessage === 'function' ? auth.sign(other.privateKey, auth.faceMessage(bert.publicKey, relayKey, c2.id)) : '', new PassThrough(), {}) : null;
    unknown = has('faceAnswer') ? box.faceAnswer(bert.publicKey, 'nobody-asked', signFor('nobody-asked'), new PassThrough(), {}) : null;
  } catch (e) { forged = { threw: e.message }; }
  if (forged && forged.ok === false && forged.status === 403 && unknown && unknown.ok === false && unknown.status === 404)
    test.check('an upload signed by another key is refused 403, one for an id nobody asked 404');
  else test.fail(OWED + 'forged ' + short(forged) + ', unknown ' + short(unknown));

  test.subHeading('3. faceStream: the home node\'s long upload piped into the face\'s own stream');
  const faceSide = sink();
  let opened = null;
  let fed = null;
  let none = null;
  try {
    none = has('faceFeed') ? box.faceFeed(bert.publicKey, signFor('stream'), new PassThrough()) : null;
    opened = has('faceOpen') ? box.faceOpen(sid, faceSide) : null;
    const feed = new PassThrough();
    fed = has('faceFeed') ? box.faceFeed(bert.publicKey, signFor('stream'), feed) : null;
    feed.write('{"type":"fs","n":1}\n');
    feed.write('{"type":"fs","n":2}\n{"type":"presence","n":3}\n');
  } catch (e) { opened = { threw: e.message }; }
  await settle();
  const openEvent = events.filter(function (e) { return e.event === 'face-open'; }).length;
  if (none && none.ok === false && none.status === 409 && opened && opened.ok && openEvent === 1 && fed && fed.ok && faceSide.text.split('\n').filter(Boolean).length === 3)
    test.check('with no face open the feed is refused 409; the face opening its stream sends face-open, and the feed\'s lines reach it as written');
  else test.fail(OWED + 'none ' + short(none) + ', opened ' + short(opened) + ', face-open events ' + openEvent + ', fed ' + short(fed) + ', the face got ' + short(faceSide.text));
  faceSide.emit('close');
  await settle();
  if (events.filter(function (e) { return e.event === 'face-close'; }).length === 1) test.check('the face\'s stream ending sends face-close to the home node');
  else test.fail(OWED + 'no face-close after the face\'s stream ended');

  test.subHeading('4. the routes, and the signature');
  const server = code('spirit/relayServer.js');
  if (['/face/call', '/face/file', '/face/stream', '/api/relay/face/answer', '/api/relay/face/stream'].every(function (p) { return server.indexOf("'" + p + "'") !== -1; })
      && /faceCall\(/.test(server) && /faceAnswer\(/.test(server) && /faceOpen\(/.test(server) && /faceFeed\(/.test(server) && /x-spirit-sig/.test(server))
    test.check('relayServer serves /face/call, /face/file and /face/stream to the face, /api/relay/face/answer and /api/relay/face/stream to the home node');
  else test.fail(OWED + 'relayServer lacks the face routes');
  let sigs = null;
  try {
    const m = auth.faceMessage(bert.publicKey, relayKey, 'abc', now);
    const s = auth.sign(bert.privateKey, m);
    sigs = { own: auth.faceSignatureOk(bert.publicKey, bert.publicKey, relayKey, 'abc', s, now), otherRelay: auth.faceSignatureOk(bert.publicKey, bert.publicKey, 'OTHER', 'abc', s, now), otherId: auth.faceSignatureOk(bert.publicKey, bert.publicKey, relayKey, 'abd', s, now) };
  } catch (e) { sigs = { threw: e.message }; }
  if (sigs && sigs.own === true && sigs.otherRelay === false && sigs.otherId === false)
    test.check('faceSignatureOk holds for this relay and this id only');
  else test.fail(OWED + 'faceSignatureOk answered ' + short(sigs));
}());

done.then(function () {
  homes.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* busy */ } });
  test.reportSuccessFailureCount();
  process.exit(0);
}, function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
