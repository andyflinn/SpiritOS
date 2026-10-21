'use strict';

// spirit/test/faceHome.js
// goal/G30.13, step 2 of goal/G30.10: the home node answers its face. Red on today's tree; claude-windows writes it
// and builds it (one agent). The box, in short:
//   - The home node answers face requests through the door a puppeteer uses on it: the local shell's whole interface,
//     minus the email and face changes with the relay.
//   - It streams to the face what it streams to its loopback shell.
//   - faceStream on the home node has its own serializing queue, in priority order: 1. face requests, 2. the
//     fs-watcher stream, 3. the presence stream, 4. the app servers' streams, 5. stats, dropped whenever the queue is
//     busy; 6. the node-monitor is not sent at all. Route updates go only to the home node, never to the face.
//   - One event a line. An answer to a face request goes out on its own, at once. Everything else waiting goes out
//     together in the next write, each its own whole line; nothing merged, nothing of the fs-watcher dropped.
//   - Presence peer by peer: one event for each peer whose presence changed, not the whole table.
// NAMED HERE where the box names none:
//   - js/faceHome.js: createFaceHome({ call, serveFile, upload, identity, relayKey, jobs, log }) -> { request(url,
//     data), open(url), close(url) }. call is the puppeteer's door (nodeDoor.call); serveFile(rel, res) is the node's
//     own GET of a file; upload(url, path, headers) is a writable POST to that relay. A face request { get: path }
//     is a file, any other { verb, ... } a verb.
//   - faceRefuses(request) -> the reason a face may not ask it, or '': relay.face, relay.join, and a peer.post
//     carrying { face }.
//   - createFaceQueue(sink) -> { push(priority, event) }, FACE_PRIORITY { fs: 2, presence: 3, app: 4, stats: 5 }.
//   - presenceNode hands the relay's face, face-open and face-close events to onFace, onFaceOpen and onFaceClose.
//   - The answer is signed relayAuth.faceMessage for its id, the stream for 'stream', in x-spirit-sig.
// Driven against the real relay (relay.faceCall, faceAnswer, faceOpen, faceFeed): what the face receives is the
// outcome checked. rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const { PassThrough } = require('stream');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.13: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
function settle() { return new Promise(function (r) { setTimeout(r, 15); }); }
function lines(text) { return String(text || '').split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return { unparsed: l }; } }); }
const homes = [];

test.startTest('goal/G30.13: the home node answers its face, and streams to it');

let faceHome = null;
try { faceHome = require('../run/js/faceHome'); } catch (e) { faceHome = null; }
const made = !!(faceHome && typeof faceHome.createFaceHome === 'function');

// The relay, as in faceStream.js: bert seated with a verified email, a face name, his node's stream kept, a login.
const auth = require('../run/js/relayAuth');
const plant = require('./plantIdentity.js');
const relayStore = require('../run/js/relayStore');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'g3013-'));
homes.push(home);
plant.ensureAt(home, 'relay');
auth.writeOwner(home, auth.generateIdentity('andy').publicKey);
const bert = auth.generateIdentity('bert');
fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
fs.writeFileSync(path.join(home, 'relay-state', 'face.json'), JSON.stringify({ domain: 'relay.example' }));
const mails = [];
let now = Date.now();
const box = require('../run/js/relay').createRelay(home, { now: function () { return now; }, sendMail: function (m) { mails.push(m); return Promise.resolve({ ok: true }); } });
const relayKey = box.relayPublicKey();
const URL_ = 'https://relay.example';
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

// The home node's uploads land in the real relay, which checks their signatures.
const uploads = [];
function upload(url, p, headers) {
  const pt = new PassThrough();
  const h = headers || {};
  const m = /^\/api\/relay\/face\/answer\?id=(.+)$/.exec(p);
  let said = null;
  if (m) said = box.faceAnswer(h['x-spirit-from'], decodeURIComponent(m[1]), h['x-spirit-sig'], pt, { status: h['x-spirit-status'], type: h['x-spirit-type'] });
  else if (p === '/api/relay/face/stream') said = box.faceFeed(h['x-spirit-from'], h['x-spirit-sig'], pt);
  uploads.push({ url: url, path: p, said: said });
  return pt;
}

// The node's jobs, as server.js's /api/events reads them.
const jobs = { events: new EventEmitter() };
const fsJob = { id: 'j-fs', type: 'fs-watcher', data: {} };
const presenceJob = { id: 'j-pr', type: 'relay-presence', data: { presence: { K1: { present: true, at: 1 }, K2: { present: false, at: 1 } } } };
const appJob = { id: 'j-app', type: 'server', module: 'process/js/desk', app: { rows: 3 } };
const statsJob = { id: 'j-st', type: 'server-stats', data: { rss: 1 } };
jobs.listJobs = function () { return [fsJob, presenceJob, appJob, statsJob]; };
jobs.fsTreeCommands = function () { return [{ createDirectory: 'shell' }, { createFile: 'shell/a.js' }]; };

const calls = [];
const node = made ? faceHome.createFaceHome({
  call: function (verb, body) { calls.push({ verb: verb, body: body }); return Promise.resolve({ ok: true, status: 200, body: { verb: verb, card: 'bert-card' } }); },
  serveFile: function (rel, res) { require('../run/js/serveCommon').sendFile(res, path.join(RUN, rel)); },
  upload: upload,
  identity: function () { return bert; },
  relayKey: function () { return relayKey; },
  jobs: jobs,
}) : null;

function ask(request) {
  const face = sink();
  const call = box.faceCall(sid, request, face);
  const sent = events.filter(function (e) { return e.event === 'face' && e.data && e.data.id === call.id; }).pop();
  if (node && sent) node.request(URL_, sent.data);
  return face;
}

const done = (async function () {
  test.subHeading('1. a face request answered through the puppeteer\'s door');
  let face = null;
  try { face = ask({ verb: 'node.card' }); } catch (e) { face = { threw: e.message }; }
  await settle(); await settle();
  const got = face && face.text ? lines(face.text)[0] : null;
  if (made && face.head && face.head.status === 200 && got && got.card === 'bert-card' && calls.length === 1 && calls[0].verb === 'node.card')
    test.check('the face asks node.card; the home node runs it through its door and the face gets the answer, signed for its id');
  else test.fail(OWED + 'the face got ' + short(face && { head: face.head, text: face.text }) + ', the door was called ' + short(calls) + ', uploads ' + short(uploads));

  let file = null;
  try { file = ask({ get: 'face.html' }); } catch (e) { file = { threw: e.message }; }
  await settle(); await settle();
  const want = fs.readFileSync(path.join(RUN, 'face.html'), 'utf8');
  if (made && file.head && file.head.status === 200 && file.text === want && /text\/html/.test(String(file.head.headers['Content-Type'] || '')))
    test.check('a file request { get } is answered with the file\'s own bytes and type, as the node\'s GET serves it');
  else test.fail(OWED + 'a file request got ' + short(file && { head: file.head, bytes: file.text.length }));

  test.subHeading('2. minus the email and face changes with the relay');
  const before = calls.length;
  const refused = [];
  try {
    [{ verb: 'relay.face', url: URL_, name: 'other' }, { verb: 'relay.join', url: URL_, email: 'x@y.z', code: '' },
      { verb: 'peer.post', to: relayKey, text: JSON.stringify({ v: 1, body: { face: { name: 'other' } } }) }].forEach(function (r) { refused.push(ask(r)); });
  } catch (e) { refused.push({ threw: e.message }); }
  await settle(); await settle();
  if (made && refused.length === 3 && refused.every(function (f) { return f.head && f.head.status === 403; }) && calls.length === before
      && faceHome.faceRefuses({ verb: 'node.card' }) === '' && faceHome.faceRefuses({ verb: 'relay.face' }) !== '')
    test.check('relay.face, relay.join and a peer.post carrying a face name are refused 403 and never reach the door');
  else test.fail(OWED + 'the refusals got ' + short(refused.map(function (f) { return f.head || f; })) + ', the door was called ' + (calls.length - before) + ' times');

  test.subHeading('3. faceStream: the face opens, and gets what the loopback shell gets');
  const view = sink();
  try {
    box.faceOpen(sid, view);
    const opened = events.filter(function (e) { return e.event === 'face-open'; }).length;
    if (node && opened) node.open(URL_);
  } catch (e) { view.text = 'threw ' + e.message; }
  await settle(); await settle();
  let got3 = lines(view.text);
  const kinds = got3.map(function (l) { return l.event + ':' + (l.data && (l.data.type || l.data.key || '')); });
  const tree = got3.filter(function (l) { return l.event === 'job-updated' && l.data && l.data.type === 'fs-watcher'; });
  const peers = got3.filter(function (l) { return l.event === 'presence'; });
  if (made && tree.length === 3 && tree[2].data.data.treeComplete === true && peers.length === 2 && peers.every(function (p) { return p.data && p.data.key && typeof p.data.present === 'boolean'; })
      && got3.some(function (l) { return l.data && l.data.module === 'process/js/desk'; }) && kinds.indexOf('job-updated:fs-watcher') < kinds.indexOf('presence:K1'))
    test.check('on face-open the face gets the tree as commands, presence peer by peer and the app servers\' objects, fs first');
  else test.fail(OWED + 'the face\'s stream got ' + short(kinds));

  const at = view.text.length;
  try {
    jobs.events.emit('job-updated', { id: 'j-pr', type: 'relay-presence', data: { presence: { K1: { present: false, at: 2 }, K2: { present: false, at: 1 }, K3: { present: true, at: 2 } } } });
    jobs.events.emit('job-updated', { id: 'j-mon', type: 'node-monitor', data: { cpu: 1 } });
  } catch (e) { /* the check says */ }
  await settle();
  const live = lines(view.text.slice(at));
  if (made && live.length === 2 && live.every(function (l) { return l.event === 'presence'; }) && live.map(function (l) { return l.data.key; }).sort().join() === 'K1,K3')
    test.check('a presence change goes peer by peer, only the peers that changed; the node-monitor is not sent');
  else test.fail(OWED + 'after a presence change the face got ' + short(live));

  test.subHeading('4. the queue: one line an event, priority order, stats dropped when busy');
  const writes = [];
  const q = new EventEmitter();
  let full = false;
  q.write = function (chunk) { writes.push(String(chunk)); return !full; };
  let queued = null;
  try {
    queued = made && typeof faceHome.createFaceQueue === 'function' ? faceHome.createFaceQueue(q) : null;
    const P = faceHome.FACE_PRIORITY;
    queued.push(P.stats, { event: 'job-updated', data: { type: 'server-stats', n: 1 } });
    full = true;
    queued.push(P.app, { event: 'job-updated', data: { n: 2 } });
    queued.push(P.app, { event: 'job-updated', data: { n: 3 } });
    queued.push(P.stats, { event: 'job-updated', data: { type: 'server-stats', n: 4 } });
    queued.push(P.presence, { event: 'presence', data: { n: 5 } });
    queued.push(P.fs, { event: 'job-updated', data: { n: 6 } });
    full = false;
    q.emit('drain');
  } catch (e) { writes.push('threw ' + e.message); }
  const second = writes[2] ? lines(writes[2]).map(function (l) { return l.data.n; }).join() : '';
  if (queued && writes.length === 3 && lines(writes[0])[0].data.n === 1 && lines(writes[1])[0].data.n === 2 && second === '6,5,3')
    test.check('idle, each event is written at once; busy, what waits goes out in one write, fs before presence before apps, the busy stats dropped');
  else test.fail(OWED + 'the queue wrote ' + short(writes));

  test.subHeading('5. face-close ends the stream; the wiring');
  const uploadsBefore = uploads.length;
  try { view.emit('close'); if (node && events.some(function (e) { return e.event === 'face-close'; })) node.close(URL_); } catch (e) { /* the check says */ }
  await settle();
  const atClose = view.text.length;
  try { jobs.events.emit('job-updated', { id: 'j-app', type: 'server', module: 'process/js/desk', app: { rows: 9 } }); } catch (e) { /* the check says */ }
  await settle();
  if (made && view.text.length === atClose && uploads.length === uploadsBefore)
    test.check('after face-close nothing more is streamed and no upload is opened');
  else test.fail(OWED + 'after face-close the face still got ' + short(view.text.slice(atClose)));

  const pn = code('js/presenceNode.js');
  const srv = code('js/server.js');
  if (/'face'/.test(pn) && /'face-open'/.test(pn) && /'face-close'/.test(pn) && /onFace\b/.test(pn) && /onFaceOpen/.test(pn) && /onFaceClose/.test(pn)
      && /createFaceHome\(/.test(srv) && /nodeDoor\.call\(/.test(srv) && /serveGet\(/.test(srv))
    test.check('presenceNode hands face, face-open and face-close on; server.js builds faceHome on nodeDoor.call and the GET it serves files with');
  else test.fail(OWED + 'the wiring is missing in presenceNode.js or server.js');
}());

done.then(function () {
  homes.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* busy */ } });
  test.reportSuccessFailureCount();
  process.exit(0);
}, function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
