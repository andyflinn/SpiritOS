'use strict';

// spirit/test/faceFixes.js
// goal/G30.15: fixes to the new shell (the face), found using it on spirit-3. Red on today's tree; claude-windows writes
// it and builds it (one agent). The box, in short:
//   - The owner's relay events (an invite minted, a claim, a rename) go to the face as they go to the local shell, so
//     Relay Details shows a new invite at once; the relay monitor still does not.
//   - The new shell's favicon.svg is 🤓, and the browser tab shows the ID's label after it.
//   - A member with an open face holds three connections: the home node's stream, the face's stream, and the home
//     node's upload feeding it. The feed upload counts in the one stream ceiling, and a seat reserves three streams.
//   - The stream allowance is the RAM left after the relay's own at-rest memory, times 16 a megabyte; the at-rest memory
//     is measured at the end of boot and kept until the next start.
//   - The status shows the parts: the relay at rest, the streams by kind and what they cost, the RAM still free, and
//     the members a megabyte serves at three streams each. README/CAPACITY.md says so.
//   - Relay Details, for its owner, shows memory and disc (set, running, what the box can give), a field for each with
//     the members that setting serves, says a change applies at the next restart, and offers Restart; it uses the
//     relay's own config and restart.
//   - peerFind fills as soon as its fold opens, and an empty search answers like any other. Since goal/G30.19 that is
//     Contacts' one list, contactSearch, which fills as soon as it is drawn.
//   - bash/face-setup writes the face site without compression.
//   - The login app's Log out is a two-press button.
// NAMED HERE where the box names none:
//   - relay.atRest(mb): the at-rest memory, set by relayServer at the end of boot; the allowance is recomputed from it.
//   - relay.capacity() -> { ramLimitMB, atRestMB, streamKB, streams: { nodes, faces, feeds }, usedMB, freeMB,
//     seatStreams: 3, members, membersPerMB }, and the owner's status report carries it as `capacity`.
//   - faceHome.ownerEvent(ev) puts { event: 'relay-event', data: ev } on every open face stream; the face shell hands
//     it to api.onRelayEvent and to the kernel's onRelayEvent. faceHome's { keys: 1 } answer carries the node's name.
// rule/11: through testSupport only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { PassThrough } = require('stream');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G30.15: ';
const ROOT = path.join(__dirname, '..', '..');
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const raw = function (rel) { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return ''; } };
const code = function (rel) { return raw(rel).split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); };
function settle() { return new Promise(function (r) { setTimeout(r, 30); }); }
const homes = [];

test.startTest('goal/G30.15: fixes to the face found on spirit-3');

const auth = require('../run/spirit/relayAuth');
const plant = require('./plantIdentity.js');
const relayStore = require('../run/spirit/relayStore');
const { createRelay } = require('../run/spirit/relay');

function relayWith(config) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'g3015-'));
  homes.push(home);
  plant.ensureAt(home, 'relay');
  auth.writeOwner(home, auth.generateIdentity('andy').publicKey);
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(home, 'relay-state', 'face.json'), JSON.stringify({ domain: 'relay.example' }));
  const mails = [];
  const box = createRelay(home, { config: config, sendMail: function (m) { mails.push(m); return Promise.resolve({ ok: true }); } });
  return { home: home, box: box, mails: mails };
}
function seat(R, who, email) {
  const before = R.mails.length;
  const asked = R.box.join(who.publicKey, email, 4242, '');
  if (asked && asked.ok === false) return asked;
  return R.box.joinConfirm(who.publicKey, ((/\?join=([A-Za-z0-9_-]+)/.exec((R.mails[before] || {}).text || '')) || [])[1] || '', '');
}

const done = (async function () {
  test.subHeading('1. the allowance after the relay\'s own memory, three streams a seat');
  const R = relayWith({ ramLimitMB: 8, discLimitMB: 64, source: 'test' });
  let cap = null;
  try { if (typeof R.box.atRest === 'function') R.box.atRest(7); cap = typeof R.box.capacity === 'function' ? R.box.capacity() : null; } catch (e) { cap = { threw: e.message }; }
  if (R.box.allowance() === 16 && cap && cap.atRestMB === 7 && cap.seatStreams === 3 && cap.members === 5 && cap.streamKB === 64
      && Math.abs(cap.membersPerMB - 16 / 3) < 0.1 && cap.streams && cap.streams.nodes === 0 && typeof cap.freeMB === 'number')
    test.check('8 MB less 7 MB at rest is 16 streams, five members at three each; capacity() says the parts');
  else test.fail(OWED + 'allowance ' + R.box.allowance() + ', capacity ' + short(cap));

  const people = [];
  for (let i = 0; i < 6; i += 1) people.push(auth.generateIdentity('m' + i));
  const said = people.map(function (p, i) { try { return seat(R, p, 'm' + i + '@example.org'); } catch (e) { return { threw: e.message }; } });
  const held = relayStore.open(R.home).members.count();
  if (held === 5 && said[5] && said[5].ok === false)
    test.check('the roll stops at five: five seats of three streams fill sixteen, and the next join is refused');
  else test.fail(OWED + 'the roll took ' + held + ' members; the sixth got ' + short(said[5]));

  test.subHeading('2. the feed upload counts in the one ceiling');
  const F = relayWith(undefined);
  const bert = auth.generateIdentity('bert');
  const carl = auth.generateIdentity('carl');
  let carlRefused = null;
  let feeds = null;
  try {
    seat(F, bert, 'bert@example.org'); seat(F, carl, 'carl@example.org');
    relayStore.open(F.home).members.setFace(bert.publicKey, 'harbour', 'bert@example.org');
    const rk = F.box.relayPublicKey();
    F.box.streamOpen(bert.publicKey, auth.sign(bert.privateKey, auth.streamMessage(bert.publicKey, rk)), { write: function () {}, end: function () {}, close: function () {} });
    F.box.faceLogin('harbour', 'bert@example.org');
    const token = ((/\?([A-Za-z0-9_-]{16,})/.exec((F.mails[F.mails.length - 1] || {}).text || '')) || [])[1] || '';
    const sid = (F.box.faceLogin('harbour', token) || {}).session || '';
    const view = new PassThrough();
    F.box.faceOpen(sid, view);
    F.box.faceFeed(bert.publicKey, auth.sign(bert.privateKey, auth.faceMessage(bert.publicKey, rk, 'stream')), new PassThrough());
    feeds = typeof F.box.capacity === 'function' ? F.box.capacity().streams : null;
    F.box.presence.setAllowed(3);
    carlRefused = F.box.streamOpen(carl.publicKey, auth.sign(carl.privateKey, auth.streamMessage(carl.publicKey, rk)), { write: function () {}, end: function () {}, close: function () {} });
  } catch (e) { carlRefused = { threw: e.message }; }
  if (carlRefused && carlRefused.ok === false && carlRefused.status === 503 && feeds && feeds.nodes === 1 && feeds.faces === 1 && feeds.feeds === 1)
    test.check('bert\'s node, face and feed fill a ceiling of three, and carl\'s stream is refused 503');
  else test.fail(OWED + 'with the ceiling at three, carl got ' + short(carlRefused) + '; streams by kind ' + short(feeds));

  test.subHeading('3. the owner\'s relay events reach the face; the keys carry the node\'s name');
  const me = (function () { const h = fs.mkdtempSync(path.join(os.tmpdir(), 'g3015n-')); homes.push(h); plant.ensureAt(h, 'bert'); return auth.loadIdentity(h); }());
  const up = {};
  const node = require('../run/spirit/faceHome').createFaceHome({
    call: function () { return Promise.resolve({ ok: true, status: 200, body: {} }); },
    serveFile: function () {},
    upload: function (url, p) { const pt = new PassThrough(); up[p] = ''; pt.on('data', function (c) { up[p] += c.toString('utf8'); }); return pt; },
    identity: function () { return me; },
    relayKey: function () { return 'RELAY'; },
    jobs: null,
  });
  let lines = null;
  let keys = null;
  try {
    node.open('https://relay.example', '');
    if (typeof node.ownerEvent === 'function') node.ownerEvent({ kind: 'invite-minted', invite: 'x', relay: 'https://relay.example' });
    node.request('https://relay.example', { id: 'k', request: { keys: 1 } });
    await settle();
    lines = String(up['/api/relay/face/stream'] || '').split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); });
    keys = JSON.parse(up['/api/relay/face/answer?id=k'] || 'null');
  } catch (e) { lines = { threw: e.message }; }
  const ev = Array.isArray(lines) ? lines.filter(function (l) { return l.event === 'relay-event'; })[0] : null;
  if (ev && ev.data && ev.data.kind === 'invite-minted' && keys && keys.name === me.name)
    test.check('an owner event goes down the face stream as relay-event, and the keys answer names the node');
  else test.fail(OWED + 'the face stream got ' + short(lines) + '; keys ' + short(keys));

  test.subHeading('4. the wiring, the screens and the files');
  const srv = code('spirit/run/spirit/server.js');
  const shell = code('spirit/run/shell/boot.js');
  const rs = code('spirit/run/spirit/relayServer.js');
  const nd = code('spirit/run/shell/natterDetails/natterDetails.js');
  const cs = code('spirit/run/shell/js/contacts/listElement.js');
  const ct = code('spirit/run/shell/contacts/contacts.js');
  const login = code('spirit/run/shell/login/login.js');
  const checks = {
    ownerEventsWired: /faceHome\.ownerEvent\(/.test(srv),
    faceOnRelayEvent: /onRelayEvent/.test(shell) && /'relay-event'/.test(shell),
    favicon: /🤓/.test(raw('spirit/run/shell/favicon.svg')) && /favicon\.svg/.test(raw('spirit/run/face.html')) && /'\/shell\/favicon\.svg'/.test(rs),
    tabTitle: /document\.title\s*=/.test(shell),
    atRestAtBoot: /\.atRest\(/.test(rs) && /memoryUsage\(\)\.rss/.test(rs),
    statusParts: /capacity/.test(code('spirit/run/spirit/relayStatus.js')) && /capacity/.test(nd) && /members a megabyte|members per megabyte|membersPerMB/.test(nd),
    allocationScreen: /ramLimitMB/.test(nd) && /discLimitMB/.test(nd) && /restart:\s*true/.test(nd) && /next restart/i.test(nd),
    listFillsWhenDrawn: /\n\s*list\.refresh\(\);\s*\n\s*return \{/.test(cs) && /spirit\.elements.contactList\.create\(/.test(ct),
    noGzip: !/encode gzip/.test(code('bash/face-setup')),
    logoutTwoPress: /data-armed|[A-Za-z]Armed\b/.test(login) && /armUntilElsewhere/.test(login),
    capacityDoc: /three/i.test(raw('README/CAPACITY.md')) && /at rest|at-rest/i.test(raw('README/CAPACITY.md')) && /G30\.15/.test(raw('README/CAPACITY.md')),
  };
  const missing = Object.keys(checks).filter(function (k) { return !checks[k]; });
  if (!missing.length)
    test.check('owner events wired to the face, 🤓 and the tab title, at-rest measured at boot, the status parts and the allocation screen, the contact list filled when drawn, no gzip, Log out two-press, CAPACITY.md');
  else test.fail(OWED + 'missing: ' + missing.join(', '));

  // Found on spirit-3 (box v16; Andy: "a do-nothing interface", "disc should be measured in GB"): the screen showed what
  // the relay booted with, and Restart wrote those figures back over the Save. Now: raising applies at once, lowering at
  // the next restart, what is set is read from the file, Restart only restarts, a refusal stays, disc in GB.
  // NAMED HERE: relay.reconfigure(ask) is exported (the owner's config verb, as its post reaches it), and createRelay
  // takes deps.readConfig, the file as it stands, beside writeConfig and restart.
  test.subHeading('5. the allocation screen does what it says');
  let file = { ramLimitMB: 8, discLimitMB: 64 };
  const restarts = [];
  const home5 = fs.mkdtempSync(path.join(os.tmpdir(), 'g3015c-'));
  homes.push(home5);
  plant.ensureAt(home5, 'relay');
  const C = createRelay(home5, { config: { ramLimitMB: 8, discLimitMB: 64, source: 'test' },
    writeConfig: function (c) { file = { ramLimitMB: c.ramLimitMB, discLimitMB: c.discLimitMB }; return true; },
    readConfig: function () { return file; },
    restart: function () { restarts.push(1); return { will: true }; } });
  let raise5 = null; let down = null; let readBack = null; let only = null; const fileBefore = {};
  try {
    raise5 = C.reconfigure({ ramLimitMB: 16, discLimitMB: 128 });
    const raised = { allowance: C.allowance(), cap: C.capacity().ramLimitMB };
    down = C.reconfigure({ ramLimitMB: 12, discLimitMB: 128 });
    down.allowanceAfter = C.allowance();
    readBack = C.reconfigure({});
    Object.assign(fileBefore, file);
    only = C.reconfigure({ restart: true });
    raise5.raised = raised;
  } catch (e) { raise5 = { threw: e.message }; }
  if (raise5 && raise5.ok && raise5.raised && raise5.raised.allowance === 256 && raise5.raised.cap === 16 && /now/.test(String(raise5.applies))
      && down && down.ok && /next start/.test(String(down.applies)) && down.allowanceAfter === 256
      && readBack && readBack.onFile && readBack.onFile.ramLimitMB === 12
      && only && only.ok && only.restarting === true && restarts.length === 1 && file.ramLimitMB === fileBefore.ramLimitMB)
    test.check('raising applies at once, lowering at the next restart, set is read from the file, and Restart alone writes nothing');
  else test.fail(OWED + 'raise ' + short(raise5) + ', lower ' + short(down) + ', read ' + short(readBack && readBack.onFile) + ', restart ' + short(only) + ', restarts ' + restarts.length + ', file ' + short(file));

  const nd2 = code('spirit/run/shell/natterDetails/natterDetails.js');
  const ui = {
    discInGB: /Disc, GB/.test(nd2) && /\* 1024/.test(nd2),
    restartOnly: /\{\s*restart:\s*true\s*\}/.test(nd2) && !/discLimitMB[^}\n]*restart:\s*true/.test(nd2),
    refusalStays: /ndAllocSaid\s*=\s*\(b && b\.error\)|ndAllocSaid\s*=\s*.*refused/.test(nd2),
    relayReadsFile: /deps\.readConfig/.test(code('spirit/run/spirit/relay.js')) && /readConfig/.test(code('spirit/run/spirit/relayServer.js')),
  };
  // Box v17-v19 (Andy: "why would the relay not stash my login on my member-row?", "save the cookie 1. after login 2.
  // after re-connect 3. every day", "delete it on logoff/logout"; one login per device): a face login survives a relay
  // restart. NAMED HERE: relayStore members.faceLogins / setFaceLogins / byFaceLogin; the row holds the cookie's hash.
  test.subHeading('6. a face login survives a relay restart');
  let L = null;
  try {
    let t6 = Date.now();
    const clock = function () { return t6; };
    const home6 = fs.mkdtempSync(path.join(os.tmpdir(), 'g3015l-'));
    homes.push(home6);
    plant.ensureAt(home6, 'relay');
    auth.writeOwner(home6, auth.generateIdentity('andy').publicKey);
    fs.mkdirSync(path.join(home6, 'relay-state'), { recursive: true });
    fs.writeFileSync(path.join(home6, 'relay-state', 'face.json'), JSON.stringify({ domain: 'relay.example' }));
    const mails6 = [];
    const mk = function () { return createRelay(home6, { now: clock, sendMail: function (m) { mails6.push(m); return Promise.resolve({ ok: true }); } }); };
    let box6 = mk();
    const dave = auth.generateIdentity('dave');
    box6.join(dave.publicKey, 'dave@example.org', 4242, '');
    box6.joinConfirm(dave.publicKey, ((/\?join=([A-Za-z0-9_-]+)/.exec((mails6[0] || {}).text || '')) || [])[1] || '', '');
    relayStore.open(home6).members.setFace(dave.publicKey, 'dock', 'dave@example.org');
    const loginOnce = function (b) {
      t6 += 2 * 60 * 1000;
      b.faceLogin('dock', 'dave@example.org');
      const tok = ((/\?([A-Za-z0-9_-]{16,})/.exec((mails6[mails6.length - 1] || {}).text || '')) || [])[1] || '';
      return (b.faceLogin('dock', tok) || {}).session || '';
    };
    const sidA = loginOnce(box6);
    const sidB = loginOnce(box6);                 // a second device
    box6 = mk();                                  // the relay restarts
    const afterRestart = [box6.faceSession(sidA).ok, box6.faceSession(sidB).ok];
    const rowText = JSON.stringify(relayStore.open(home6).members.get(dave.publicKey));
    const clear = rowText.indexOf(sidA) !== -1 || rowText.indexOf(sidB) !== -1;
    // A reconnect writes the deadline: three days on, dave's face stream opens; nine days after login it still holds.
    box6.streamOpen(dave.publicKey, auth.sign(dave.privateKey, auth.streamMessage(dave.publicKey, box6.relayPublicKey())), { write: function () {}, end: function () {}, close: function () {} });
    t6 += 3 * 24 * 3600 * 1000;
    box6.faceOpen(sidB, new PassThrough());
    box6.faceLogout(sidA);
    t6 += 6 * 24 * 3600 * 1000;
    box6 = mk();
    const afterLogout = [box6.faceSession(sidA).ok, box6.faceSession(sidB).ok];
    t6 += 8 * 24 * 3600 * 1000;
    box6 = mk();
    const afterIdle = box6.faceSession(sidB).ok;
    L = { afterRestart: afterRestart, clear: clear, afterLogout: afterLogout, afterIdle: afterIdle };
  } catch (e) { L = { threw: e.message }; }
  if (L && L.afterRestart && L.afterRestart[0] === true && L.afterRestart[1] === true && L.clear === false
      && L.afterLogout[0] === false && L.afterLogout[1] === true && L.afterIdle === false)
    test.check('two devices stay logged in across a restart, the row holds no cookie, a reconnect moves the deadline, Log out removes one, and 7 idle days end it');
  else test.fail(OWED + 'logins across a restart: ' + short(L));

  const uiMissing = Object.keys(ui).filter(function (k) { return !ui[k]; });
  if (!uiMissing.length) test.check('the screen sets disc in GB, keeps a refusal, Restart sends only the restart, and the relay reads its own file');
  else test.fail(OWED + 'missing: ' + uiMissing.join(', '));
}());

done.then(function () {
  homes.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* busy */ } });
  test.reportSuccessFailureCount();
  process.exit(0);
}, function (e) { test.fail('the suite threw ' + e.message); test.reportSuccessFailureCount(); process.exit(0); });
