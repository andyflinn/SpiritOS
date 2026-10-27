'use strict';

// spirit/test/faceSealed.js
// goal/G30.11, step 3 of goal/G30.10: the sealed link and the face loading from its home node. Red on today's tree;
// claude-windows writes it and builds it (one agent). The box, in short:
//   - The relay serves face.html and the login app, nothing else. After login the face sets up a sealed link with the
//     home node (its key lost with the session) and loads everything else from the home node, lazily, in the home
//     node's own version. In this item the face runs Contacts only, loaded from the start; Files comes later.
//   - The face shell makes every call asynchronously.
//   - The seal is the node's own (X25519, HKDF-SHA256, AES-256-GCM) in WebCrypto; large files sealed piece by piece.
//     A browser without X25519 is served unsealed, with a warning that its traffic is readable on the relay.
//   - The login says a relay owner who swaps face.html or the login app could read what the face shows.
//   - With the home node offline the face keeps its shell and shows the small red not connected mark.
//   - After this item the face shell is no longer waiting for plumbing.
// NAMED HERE where the box names none:
//   - shell/seal.js: window.faceSeal (and module.exports) { supported, newKey, seal, open }, byte for byte the node's
//     seal.js: what one seals the other opens.
//   - A sealed face request is { sealed: 1, e, n, c, k } (k the face's key), sealed from k to the home node's key; the
//     answer is ndjson, each line sealed from the home node to k: first { status, type }, then the body in pieces,
//     each piece's text its bytes in base64.
//   - GET /face/stream?key=<k> hands k to the home node in face-open; each stream line is then sealed to k.
//   - kernel.js takes window.spirit.transport { ask, events } when the face shell sets it.
// The browser shell is checked by its code (there is no DOM here); the seal, the home node and the relay by running
// them. rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const { PassThrough } = require('stream');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.11: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const raw = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; } };
const code = function (rel) { return raw(rel).split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); };
function settle(ms) { return new Promise(function (r) { setTimeout(r, ms || 20); }); }
function lines(text) { return String(text || '').split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return { unparsed: l }; } }); }
const homes = [];

test.startTest('goal/G30.11: the sealed link, and the face loading from its home node');

const seal = require('../run/spirit/seal');
let faceSeal = null;
try { faceSeal = require('../run/shell/seal.js'); } catch (e) { faceSeal = null; }
const sealMade = !!(faceSeal && typeof faceSeal.seal === 'function' && typeof faceSeal.open === 'function');

// The relay and bert, as in faceHome.js.
const auth = require('../run/spirit/relayAuth');
const plant = require('./plantIdentity.js');
const relayStore = require('../run/spirit/relayStore');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'g3011-'));
homes.push(home);
plant.ensureAt(home, 'relay');
auth.writeOwner(home, auth.generateIdentity('andy').publicKey);
const bert = auth.generateIdentity('bert');
// bert's seal key, as nodeCard gives a node one.
const sealPair = require('crypto').generateKeyPairSync('x25519');
bert.sealPublicKey = sealPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
bert.sealPrivateKey = sealPair.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
fs.writeFileSync(path.join(home, 'relay-state', 'face.json'), JSON.stringify({ domain: 'relay.example' }));
const mails = [];
let now = Date.now();
const box = require('../run/spirit/relay').createRelay(home, { now: function () { return now; }, sendMail: function (m) { mails.push(m); return Promise.resolve({ ok: true }); } });
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
function upload(url, p, headers) {
  const pt = new PassThrough();
  const h = headers || {};
  const m = /^\/api\/relay\/face\/answer\?id=(.+)$/.exec(p);
  if (m) box.faceAnswer(h['x-spirit-from'], decodeURIComponent(m[1]), h['x-spirit-sig'], pt, { status: h['x-spirit-status'], type: h['x-spirit-type'] });
  else if (p === '/api/relay/face/stream') box.faceFeed(h['x-spirit-from'], h['x-spirit-sig'], pt);
  return pt;
}
const jobs = { events: new EventEmitter() };
const fsJob = { id: 'j-fs', type: 'fs-watcher', data: {} };
jobs.listJobs = function () { return [fsJob, { id: 'j-pr', type: 'relay-presence', data: { presence: { K1: { present: true, at: 1 } } } }]; };
jobs.fsTreeCommands = function () { return [{ createDirectory: 'shell' }]; };
const big = Buffer.alloc(300 * 1024);
for (let i = 0; i < big.length; i++) big[i] = i % 251;
const node = require('../run/spirit/faceHome').createFaceHome({
  call: function (verb) { return Promise.resolve({ ok: true, status: 200, body: { verb: verb, publicKey: bert.publicKey, sealKey: bert.sealPublicKey } }); },
  serveFile: function (rel, res) {
    if (rel === 'big.bin') { res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); res.end(big); return; }
    require('../run/spirit/serveCommon').sendFile(res, path.join(RUN, rel));
  },
  upload: upload,
  identity: function () { return bert; },
  relayKey: function () { return relayKey; },
  jobs: jobs,
});
function ask(request) {
  const face = sink();
  const call = box.faceCall(sid, request, face);
  const sent = events.filter(function (e) { return e.event === 'face' && e.data && e.data.id === call.id; }).pop();
  if (sent) node.request(URL_, sent.data);
  return face;
}
// The face's side: open each sealed line, the first the head, the rest the body's pieces.
async function opened(face, key) {
  const out = { head: null, bytes: Buffer.alloc(0), lines: 0, refused: 0 };
  for (const l of lines(face.text)) {
    out.lines += 1;
    const got = await faceSeal.open(key.privateKey, key.publicKey, bert.publicKey, key.publicKey, l);
    if (!got) { out.refused += 1; continue; }
    if (!out.head) out.head = JSON.parse(got.text);
    else out.bytes = Buffer.concat([out.bytes, Buffer.from(got.text, 'base64')]);
  }
  return out;
}

const done = (async function () {
  test.subHeading('1. shell/seal.js is the node\'s seal, in WebCrypto');
  let both = null;
  try {
    const key = await faceSeal.newKey();
    const toNode = await faceSeal.seal(bert.sealPublicKey, key.publicKey, bert.publicKey, 'hello node');
    const nodeRead = seal.open(bert.sealPrivateKey, key.publicKey, bert.publicKey, toNode);
    const toFace = seal.seal(key.publicKey, bert.publicKey, key.publicKey, 'hello face');
    const faceRead = await faceSeal.open(key.privateKey, key.publicKey, bert.publicKey, key.publicKey, toFace);
    const wrongPair = await faceSeal.open(key.privateKey, key.publicKey, 'someone-else', key.publicKey, toFace);
    both = { node: nodeRead && nodeRead.text, face: faceRead && faceRead.text, wrong: wrongPair, ok: await faceSeal.supported() };
  } catch (e) { both = { threw: e.message }; }
  if (sealMade && both && both.node === 'hello node' && both.face === 'hello face' && both.wrong === null && both.ok === true)
    test.check('what shell/seal.js seals the node\'s seal.js opens, and back; sealed for another pair it does not open');
  else test.fail(OWED + 'shell/seal.js answered ' + short(both));

  test.subHeading('2. a sealed request, answered sealed, a large file in pieces');
  let card = null;
  let file = null;
  try {
    const key = await faceSeal.newKey();
    const req = await faceSeal.seal(bert.sealPublicKey, key.publicKey, bert.publicKey, JSON.stringify({ verb: 'node.card' }));
    const a = ask(Object.assign({ k: key.publicKey }, req));
    const reqFile = await faceSeal.seal(bert.sealPublicKey, key.publicKey, bert.publicKey, JSON.stringify({ get: 'big.bin' }));
    const b = ask(Object.assign({ k: key.publicKey }, reqFile));
    await settle(60);
    card = await opened(a, key);
    card.plainOnWire = /sealKey|node\.card/.test(a.text);
    card.body = card.bytes.length ? JSON.parse(card.bytes.toString('utf8')) : null;
    file = await opened(b, key);
  } catch (e) { card = { threw: e.message }; }
  if (sealMade && card && card.head && card.head.status === 200 && card.body && card.body.verb === 'node.card' && !card.plainOnWire && card.refused === 0)
    test.check('node.card asked sealed comes back sealed: the relay carried no word of it in the clear');
  else test.fail(OWED + 'the sealed node.card came back ' + short(card));
  if (file && file.head && file.head.status === 200 && file.bytes.equals(big) && file.lines >= 4)
    test.check('a 300 KB file comes back sealed piece by piece (' + (file && file.lines) + ' lines), whole');
  else test.fail(OWED + 'the sealed file came back ' + short(file && { head: file.head, bytes: file.bytes && file.bytes.length, lines: file.lines }));

  let plain = null;
  try { const p = ask({ verb: 'node.card' }); await settle(); plain = { head: p.head, body: lines(p.text)[0] }; } catch (e) { plain = { threw: e.message }; }
  if (plain && plain.head && plain.head.status === 200 && plain.body && plain.body.verb === 'node.card')
    test.check('a browser without X25519 is still answered, unsealed');
  else test.fail(OWED + 'an unsealed request got ' + short(plain));

  test.subHeading('3. the stream sealed to the face\'s key, handed over by face-open');
  let stream = null;
  try {
    const key = await faceSeal.newKey();
    const view = sink();
    box.faceOpen(sid, view, { key: key.publicKey });
    const open = events.filter(function (e) { return e.event === 'face-open'; }).pop();
    node.open(URL_, open && open.data && open.data.key);
    await settle(60);
    const got = [];
    for (const l of lines(view.text)) {
      const o = await faceSeal.open(key.privateKey, key.publicKey, bert.publicKey, key.publicKey, l);
      got.push(o ? JSON.parse(o.text) : null);
    }
    stream = { keyed: !!(open && open.data && open.data.key === key.publicKey), got: got, clear: /fs-watcher|presence/.test(view.text) };
  } catch (e) { stream = { threw: e.message }; }
  if (stream && stream.keyed && stream.got.length >= 3 && stream.got.every(Boolean) && !stream.clear
      && stream.got.some(function (e) { return e.event === 'presence'; }))
    test.check('face-open carries the face\'s key, and every line of the stream is sealed to it');
  else test.fail(OWED + 'the stream was ' + short(stream));
  const server = code('spirit/relayServer.js');
  if (/searchParams\.get\('key'\)/.test(server) && /'\/shell\/seal\.js'/.test(server))
    test.check('relayServer hands ?key= to faceOpen, and serves shell/seal.js beside face.html');
  else test.fail(OWED + 'relayServer reads no key on /face/stream, or does not serve shell/seal.js');

  test.subHeading('4. the face shell, by its code');
  const shell = code('shell/boot.js');
  const kernel = code('spirit/kernel.js');
  const html = raw('face.html');
  const login = raw('shell/login/login.js') + raw('shell/login/login.json');
  const checks = {
    kernelHook: /spirit\.transport/.test(kernel) && /spirit\.transport[\s\S]{0,200}ask/.test(kernel) && /spirit\.transport[\s\S]{0,300}events/.test(kernel),
    transport: /spirit\.transport\s*=/.test(shell),
    homeVersion: /index\.html/.test(shell) && /spirit\/client\/shell\.js/.test(shell),
    contacts: /shell\/contacts\/contacts\.js/.test(shell),
    sealed: /faceSeal\.(supported|newKey)/.test(shell) && /seal\.js/.test(html),
    unsealedWarning: /readable on the relay/.test(shell),
    offline: /app-offline/.test(shell) && /app-offline/.test(html),
    connectHere: /here=1/.test(shell) && /taken/.test(shell),
    noSync: !/XMLHttpRequest/.test(shell),
    ownerWarning: /face\.html/.test(login) && /relay owner|owner of this relay/i.test(login),
    noPlumbingWait: !/Waiting for plumbing/i.test(login),
  };
  const missing = Object.keys(checks).filter(function (k) { return !checks[k]; });
  if (!missing.length)
    test.check('kernel takes the face\'s transport; the face loads the home node\'s own page parts and Contacts, sealed or warned, async only, with the offline mark, Connect here and taken, the owner warning on login, and no wait for plumbing');
  else test.fail(OWED + 'the face shell lacks: ' + missing.join(', '));
}());

done.then(function () {
  homes.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* busy */ } });
  test.reportSuccessFailureCount();
  process.exit(0);
}, function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
