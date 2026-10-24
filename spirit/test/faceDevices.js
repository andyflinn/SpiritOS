'use strict';

// spirit/test/faceDevices.js
// goal/G30.12, step 4 of goal/G30.10: one face stream per member. Red on today's tree; claude-windows writes it and
// builds it (one agent). The box, in short:
//   - One face stream per member. A face opened while another device holds it warns: your face is open on another
//     device; connecting here ends it there. Only its Connect here press moves the stream; the face it replaced gets a
//     last event, taken by another device, and says so.
//   - The same login reconnecting (a reload, a dropped network) replaces its own stream without the warning.
//   - The face stream counts in the relay's one stream ceiling, so a full relay refuses a new face as it refuses a
//     member's stream: at most two streams per member.
// NAMED HERE where the box names none:
//   - relay.faceOpen(sid, sink, { here }) -> 409 { code: 'face-elsewhere' } for another login while one is open;
//     with here the stream moves, and the old one gets the line { event: 'taken' } and ends. GET /face/stream?here=1.
//   - The home node hears face-open again when the stream moves, so it feeds the new one; its old upload is unpiped
//     from the ended stream.
//   - presence.createRegistry({ others }) counts the face streams against the one allowance.
// The face's own Connect here button belongs with the face opening its stream, goal/G30.11; this suite asks the
// relay. rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { PassThrough } = require('stream');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.12: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };
function settle() { return new Promise(function (r) { setTimeout(r, 15); }); }
function lines(text) { return String(text || '').split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return { unparsed: l }; } }); }
const homes = [];

test.startTest('goal/G30.12: one face stream per member, Connect here, and the stream ceiling');

const auth = require('../run/spirit/relayAuth');
const plant = require('./plantIdentity.js');
const relayStore = require('../run/spirit/relayStore');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'g3012-'));
homes.push(home);
plant.ensureAt(home, 'relay');
auth.writeOwner(home, auth.generateIdentity('andy').publicKey);
const bert = auth.generateIdentity('bert');
const carl = auth.generateIdentity('carl');
fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
fs.writeFileSync(path.join(home, 'relay-state', 'face.json'), JSON.stringify({ domain: 'relay.example' }));
const mails = [];
let now = Date.now();
const box = require('../run/spirit/relay').createRelay(home, { now: function () { return now; }, sendMail: function (m) { mails.push(m); return Promise.resolve({ ok: true }); } });
const relayKey = box.relayPublicKey();

function seat(who, email, port) {
  const before = mails.length;
  box.join(who.publicKey, email, port, '');
  box.joinConfirm(who.publicKey, ((/\?join=([A-Za-z0-9_-]+)/.exec((mails[before] || {}).text || '')) || [])[1] || '', '');
}
function nodeStream(who, kept) {
  return box.streamOpen(who.publicKey, auth.sign(who.privateKey, auth.streamMessage(who.publicKey, relayKey)), {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      if (ev && kept) kept.push(ev[1]);
    },
    end: function () {},
    close: function () {},
  });
}
function login() {
  now += 2 * 60 * 1000;
  box.faceLogin('harbour', 'bert@example.org');
  const token = ((/\?([A-Za-z0-9_-]{16,})/.exec((mails[mails.length - 1] || {}).text || '')) || [])[1] || '';
  return (box.faceLogin('harbour', token) || {}).session || '';
}
function sink() {
  const s = new PassThrough();
  s.text = '';
  s.ended = false;
  s.on('data', function (c) { s.text += c.toString('utf8'); });
  s.on('end', function () { s.ended = true; });
  return s;
}

const events = [];
let sidA = '';
let sidB = '';
try {
  seat(bert, 'bert@example.org', 4242);
  seat(carl, 'carl@example.org', 4343);
  relayStore.open(home).members.setFace(bert.publicKey, 'harbour', 'bert@example.org');
  nodeStream(bert, events);
  sidA = login();
  sidB = login();
} catch (e) { /* the checks say what is missing */ }
function count(name) { return events.filter(function (e) { return e === name; }).length; }
function signed() { return typeof auth.faceMessage === 'function' ? auth.sign(bert.privateKey, auth.faceMessage(bert.publicKey, relayKey, 'stream')) : ''; }

const done = (async function () {
  test.subHeading('1. the same login reconnecting replaces its own stream, no warning');
  const a1 = sink();
  const a2 = sink();
  let r1 = null;
  let r2 = null;
  try { r1 = box.faceOpen(sidA, a1); r2 = box.faceOpen(sidA, a2); } catch (e) { r2 = { threw: e.message }; }
  a1.emit('close');
  await settle();
  if (r1 && r1.ok && r2 && r2.ok && a1.ended && !/taken/.test(a1.text) && count('face-open') === 2 && count('face-close') === 0)
    test.check('a reload of the same login replaces its stream at once: the old one ends without taken, and no face-close');
  else test.fail(OWED + 'first ' + short(r1) + ', second ' + short(r2) + ', old ended ' + a1.ended + ' with ' + short(a1.text) + ', face-open ' + count('face-open') + ', face-close ' + count('face-close'));

  test.subHeading('2. another device is warned, and moves the stream only with Connect here');
  const feed1 = new PassThrough();
  let fed1 = null;
  try { fed1 = box.faceFeed(bert.publicKey, signed(), feed1); feed1.write('{"event":"x","data":1}\n'); } catch (e) { fed1 = { threw: e.message }; }
  await settle();
  const b1 = sink();
  let warned = null;
  try { warned = box.faceOpen(sidB, b1); } catch (e) { warned = { threw: e.message }; }
  if (warned && warned.ok === false && warned.status === 409 && warned.code === 'face-elsewhere' && /another device/.test(String(warned.error || '')) && !a2.ended)
    test.check('a second login is answered 409 face-elsewhere, "your face is open on another device", and the first face keeps its stream');
  else test.fail(OWED + 'a second login opening got ' + short(warned) + '; the first face ended ' + a2.ended);

  const b2 = sink();
  let moved = null;
  const opensBefore = count('face-open');
  try { moved = box.faceOpen(sidB, b2, { here: true }); } catch (e) { moved = { threw: e.message }; }
  a2.emit('close');
  await settle();
  const last = lines(a2.text).pop();
  if (moved && moved.ok && a2.ended && last && last.event === 'taken' && count('face-open') === opensBefore + 1 && count('face-close') === 0)
    test.check('Connect here moves it: the old face gets a last taken line and ends, the home node hears face-open to feed the new one');
  else test.fail(OWED + 'Connect here got ' + short(moved) + '; the old face ended ' + a2.ended + ' with last line ' + short(last) + '; face-open +' + (count('face-open') - opensBefore) + ', face-close ' + count('face-close'));

  let threw = '';
  try { feed1.write('{"event":"late","data":2}\n'); } catch (e) { threw = e.message; }
  const feed2 = new PassThrough();
  let fed2 = null;
  try { fed2 = box.faceFeed(bert.publicKey, signed(), feed2); feed2.write('{"event":"fresh","data":3}\n'); } catch (e) { fed2 = { threw: e.message }; }
  await settle();
  if (fed1 && fed1.ok && fed2 && fed2.ok && !threw && /fresh/.test(b2.text) && !/late/.test(b2.text) && !/late/.test(a2.text))
    test.check('the home node\'s old upload is cut from the ended stream, and its new one reaches the new face');
  else test.fail(OWED + 'feeds ' + short([fed1, fed2]) + ', threw ' + short(threw) + ', new face ' + short(b2.text) + ', old face ' + short(a2.text));

  test.subHeading('3. the face stream counts in the one ceiling');
  let carlRefused = null;
  let carlIn = null;
  let faceRefused = null;
  try {
    box.presence.setAllowed(2);                  // bert's node and bert's face fill it
    carlRefused = nodeStream(carl);
    b2.emit('close');                            // bert's face leaves
    feed2.destroy();                             // and his node ends its feed, as on face-close (counted since G30.15)
    await settle();
    carlIn = nodeStream(carl);                   // carl takes the room
    faceRefused = box.faceOpen(sidB, sink());    // and a new face finds it full
  } catch (e) { faceRefused = { threw: e.message }; }
  if (carlRefused && carlRefused.ok === false && carlRefused.status === 503 && carlIn && carlIn.ok && faceRefused && faceRefused.ok === false && faceRefused.status === 503)
    test.check('with the ceiling at two, bert\'s face keeps carl out (503); once it leaves carl gets in, and a new face is refused 503');
  else test.fail(OWED + 'carl refused ' + short(carlRefused) + ', carl in ' + short(carlIn) + ', the face ' + short(faceRefused));

  test.subHeading('4. the route and the register');
  const server = code('spirit/relayServer.js');
  const register = (function () { try { return fs.readFileSync(path.join(__dirname, '..', '..', 'design', 'decisions', '0010-fix-the-protocol-or-name-the-cheat.md'), 'utf8'); } catch (e) { return ''; } }());
  if (/searchParams\.get\('here'\)/.test(server) && /face-elsewhere|code/.test(server) && /`taken`/.test(register))
    test.check('GET /face/stream?here=1 is Connect here, the refusal carries its code, and decision 0010 registers taken');
  else test.fail(OWED + 'the route reads no here, or 0010 has no taken row');
}());

done.then(function () {
  homes.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* busy */ } });
  test.reportSuccessFailureCount();
  process.exit(0);
}, function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
