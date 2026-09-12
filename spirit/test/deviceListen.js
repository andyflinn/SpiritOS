'use strict';

// spirit/test/deviceListen.js
// Cycle 3. Listening flag + one tick installs the slot. No browser.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const deviceAuth = require('../run/js/deviceAuth');
const deviceTick = require('../run/js/deviceTick');
const world = require('./world');
const { createHub } = require('../run/js/hub');

// An owner, a relay, and nobody else. Built TWICE below, and the second
// has to be its own build rather than a second door onto the first: a
// wrong password is only refused meaningfully by a door that was
// genuinely open, which means its own home, password and slot.
const SCENARIO = require('./scenario').OWNER_ONLY;

// Several checks below want nothing but a bare directory — a node with no
// key, no relay and no history, which is what a restart finds on a
// machine nobody has configured. That is not a world and should not be
// built as one.
const tmpHome = world.tmpHome;

// What a held stream looks like from the relay's side. Same shape
// presenceStream.js uses, because it is the same sink.
function fakeSink() {
  const sink = {
    lines: [],
    closed: false,
    write: function (chunk) { sink.lines.push(chunk); },
    close: function () { sink.closed = true; },
  };
  sink.events = function () {
    return sink.lines.map(function (chunk) {
      const ev = /event: (.*)/.exec(chunk);
      const data = /data: (.*)/.exec(chunk);
      let parsed = null;
      try { parsed = data ? JSON.parse(data[1]) : null; } catch (e) { parsed = null; }
      return { event: ev ? ev[1] : '', data: parsed };
    }).filter(function (e) { return e.event; });
  };
  return sink;
}

// A DEVICE BELONGS TO THE IDENTITY, NOT TO THE MAILBOX THAT ENROLLED IT.
//
// Andy attached a browser to a lab peer who was on two relays, and it
// worked — on one of them. The handshake happens wherever the password
// was typed, and the slot was installed only there, so the enrolled
// browser could read one mailbox and was a stranger to the other. That
// is not what "add this device" says.
//
// Two relays, one identity on both, the offer arriving on the SECOND —
// deliberately not the first, because installing on "the one that had
// the offer" and installing on "the first in the list" look identical
// in a world where those are the same relay.
async function oneDeviceEveryMailbox() {
  test.subHeading('A device enrolled on one mailbox works on all of them');

  const W = world.build({
    title: 'An owner with two mailboxes',
    relays: ['lab', 'other'],
    peers: [],
  });
  if (!W.ok) { test.fail(W.error); return; }

  const first = W.relay('lab');
  const second = W.relay('other');
  const home = W.ownerHome();
  const urls = ['http://first', 'http://second'];
  const boxFor = { 'http://first': first, 'http://second': second };
  const phone = auth.generateIdentity('device');

  deviceAuth.ensurePassword(home);
  deviceAuth.setListening(home, true);
  const password = deviceAuth.load(home).password;

  // The browser knocks on the SECOND mailbox.
  const offering = second.deviceOffer('andy', password, phone.publicKey);

  const setDeviceHits = [];
  async function requestFn(url, method, pth, body, headers) {
    const box = boxFor[url];
    if (!box) return { ok: false, error: 'unreachable' };
    if (method === 'GET' && /device-pending/.test(pth)) {
      const sig = (headers && (headers['X-Spirit-Sig'] || headers['x-spirit-sig'])) || '';
      return box.devicePending('andy', sig) || {};
    }
    if (method === 'POST' && /set-device/.test(pth)) {
      setDeviceHits.push(url);
      return box.setDevice(body.name, body.devicePublicKey, body.sig);
    }
    if (method === 'POST' && /device-answer/.test(pth)) {
      return box.deviceReply(body.name, !!body.accepted);
    }
    return { ok: false };
  }

  const did = await deviceTick.tick(home, urls, requestFn);
  const browser = await offering;

  if (did && did.did === 'installed') {
    test.check('the tick takes the offer from whichever mailbox is holding it');
  } else {
    test.fail('tick: ' + JSON.stringify(did));
  }

  if (browser && browser.ok) {
    test.check('and the browser waiting on THAT mailbox is answered by it');
  } else {
    test.fail('browser: ' + JSON.stringify(browser));
  }

  // THE WHOLE POINT, and PROVED BY USE rather than by reading the slot
  // off a row. who() deliberately does not publish device keys — they
  // are nobody else's business — so there is nothing to inspect, and a
  // read the relay accepts is a better claim than a field anyway.
  const readFirst = first.inbox('andy', auth.sign(phone.privateKey, auth.inboxMessage('andy')));
  const readSecond = second.inbox('andy', auth.sign(phone.privateKey, auth.inboxMessage('andy')));
  if (readFirst.ok && readSecond.ok) {
    test.check('and the enrolled browser can read the inbox on BOTH, not only the enrolling one');
  } else {
    test.fail('reads: first=' + JSON.stringify(readFirst.ok) + ' second=' + JSON.stringify(readSecond.ok));
  }

  // The other direction, so the check above cannot pass by the relay
  // being lax: a browser that enrolled nowhere is refused by both.
  const nobody = auth.generateIdentity('uninvited');
  const noFirst = first.inbox('andy', auth.sign(nobody.privateKey, auth.inboxMessage('andy')));
  const noSecond = second.inbox('andy', auth.sign(nobody.privateKey, auth.inboxMessage('andy')));
  if (!noFirst.ok && !noSecond.ok) {
    test.check('while a key that enrolled nowhere is refused by both');
  } else {
    test.fail('a stranger read an inbox: ' + JSON.stringify({ first: noFirst.ok, second: noSecond.ok }));
  }

  // Said out loud, because a device on two mailboxes out of three is a
  // device that fails somewhere the person has no reason to expect.
  if ((did.installedOn || []).length === 2 && (did.missedOn || []).length === 0) {
    test.check('and the tick says which mailboxes took it, and which did not');
  } else {
    test.fail('spread: ' + JSON.stringify({ on: did.installedOn, missed: did.missedOn }));
  }

  // A MAILBOX THAT IS DOWN MUST NOT SINK THE ENROLMENT. The browser is
  // standing in front of one relay; another being unreachable is this
  // node's bookkeeping and not that person's problem.
  const W2 = world.build({ relays: ['lab', 'other'], peers: [] });
  if (!W2.ok) { test.fail(W2.error); return; }
  const live = W2.relay('lab');
  const home2 = W2.ownerHome();
  deviceAuth.ensurePassword(home2);
  deviceAuth.setListening(home2, true);
  const phone2 = auth.generateIdentity('device2');
  const offering2 = live.deviceOffer('andy', deviceAuth.load(home2).password, phone2.publicKey);

  async function halfDown(url, method, pth, body, headers) {
    if (url === 'http://down') return { ok: false, error: 'unreachable' };
    if (method === 'GET' && /device-pending/.test(pth)) {
      const sig = (headers && (headers['X-Spirit-Sig'] || headers['x-spirit-sig'])) || '';
      return live.devicePending('andy', sig) || {};
    }
    if (method === 'POST' && /set-device/.test(pth)) {
      return live.setDevice(body.name, body.devicePublicKey, body.sig);
    }
    if (method === 'POST' && /device-answer/.test(pth)) {
      return live.deviceReply(body.name, !!body.accepted);
    }
    return { ok: false };
  }

  const partial = await deviceTick.tick(home2, ['http://up', 'http://down'], halfDown);
  const browser2 = await offering2;
  if (partial.did === 'installed' && browser2 && browser2.ok &&
      (partial.missedOn || []).indexOf('http://down') !== -1) {
    test.check('and one unreachable mailbox does not fail the enrolment — it is named instead');
  } else {
    test.fail('partial: ' + JSON.stringify(partial) + ' browser=' + JSON.stringify(browser2));
  }

  if (deviceAuth.load(home2).devicePublicKey === phone2.publicKey) {
    test.check('and the node records the device, because somewhere took it');
  } else {
    test.fail('node did not record a device that one mailbox holds');
  }
}

// THE RELAY POSTS, AS ITSELF.
//
// An offer used to sit in the relay's slot until the node next asked,
// which is once a minute: uniformly 0-60 seconds from pressing the
// button to being enrolled. Andy lived it — "works reliably when I click
// 10 seconds before the node polls, fails reliably 10 seconds after."
//
// That was never a decision. Device cycle 2 landed on 2026-09-10 and
// presence on the 11th, so when this was built there was no stream to
// push down.
//
// The first attempt at fixing it invented a `device` event: a bespoke,
// unsigned push sitting in the middle of a channel whose every other
// packet is signed and verified. Andy: "it simply creates a standard
// spirit POST request with its own signature, and treats the transaction
// simply like the far end of any spirit post... EXACT SAME procedure."
//
// So there is no device transport. There is a relay making an ordinary
// post, and these checks are about it being ordinary.
//
// What it carries is NOT an app packet: the envelope lives inside `text`
// so that a relay never learns it, and spirit/test/packet.js holds that
// line. This is the relay talking to a node about the node's own
// enrolment — protocol, in the relay's own shape.

async function theRelayPostsAsItself() {
  test.subHeading('An enrolment is an ordinary post, and the relay makes it');

  const W = world.build(SCENARIO);
  if (!W.ok) { test.fail(W.error); return; }
  const box = W.box;
  const owner = W.owner;
  const phone = auth.generateIdentity('device');

  const home = W.ownerHome();
  deviceAuth.ensurePassword(home);
  const password = deviceAuth.load(home).password;

  // The node, holding the stream it already holds for presence.
  const sink = fakeSink();
  const opened = box.streamOpen(
    owner.publicKey,
    auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey)),
    sink
  );
  if (!opened || opened.ok === false) {
    test.fail('the node could not hold a stream: ' + JSON.stringify(opened));
    return;
  }

  const before = sink.events().length;
  const offering = box.deviceOffer('andy', password, phone.publicKey);
  const arrived = sink.events().slice(before).filter(function (e) { return e.event === 'request'; });

  // NOT A DEVICE EVENT. The same `request` a peer's post arrives as, so
  // the node needs no second reader and no second rule.
  if (arrived.length === 1) {
    test.check('it arrives as a `request`, the same event any post arrives as');
  } else {
    test.fail('events: ' + JSON.stringify(sink.events().slice(before)));
  }

  const req = arrived[0] && arrived[0].data;

  // SIGNED BY THE RELAY, which is the whole point. A device page has no
  // identity yet — that is what it is enrolling — so there is no
  // end-to-end signature to carry, and the relay vouching for it is the
  // only attestation there can be.
  const mailboxKey = box.snapshot().mailboxPublicKey;
  const verified = req && auth.postSignatureFor(
    req.from, req.from, req.to, req.text, req.sig
  );
  if (req && req.from === mailboxKey && verified) {
    test.check('signed by the relay itself, and it verifies against the relay key');
  } else {
    test.fail('signature: from=' + (req && String(req.from).slice(-12)) +
      ' relay=' + String(mailboxKey).slice(-12) + ' verified=' + !!verified);
  }

  // The node must be able to tell the relay apart from anybody else, and
  // the census is where it learns that key — no new endpoint.
  if (mailboxKey && req.to === owner.publicKey) {
    test.check('and addressed to the identity being enrolled, from a key the census publishes');
  } else {
    test.fail('addressing: to=' + (req && req.to));
  }

  // The payload is an ordinary packet, so the node routes it the way it
  // routes anything.
  let carried = null;
  try { carried = JSON.parse(req.text); } catch (e) { carried = null; }
  if (carried && carried.relay === 'device-offer' &&
      carried.password === password &&
      carried.devicePublicKey === phone.publicKey) {
    test.check('carrying the password and the key being offered, in the relay\'s own shape');
  } else {
    test.fail('payload: ' + req.text.slice(0, 160));
  }

  // AND NOT AN APP ENVELOPE. If this ever became one, every relay would
  // have to learn a format it has no business knowing.
  if (!carried || carried.app === undefined) {
    test.check('and not an app packet, which no relay may be taught to read');
  } else {
    test.fail('the relay sent an app envelope: ' + req.text.slice(0, 120));
  }

  // NO HASH ON THE WIRE, exactly as for a peer's post: the node derives
  // it from the bytes it holds, which is what makes it evidence.
  if (!('hash' in req)) {
    test.check('and no hash travels — the far end computes it, as it always does');
  } else {
    test.fail('a hash was sent: ' + JSON.stringify(req));
  }

  // THE ANSWER COMES BACK AS A REPLY, and resolves the browser's POST.
  // This is the one asymmetry: the relay has no stream to be answered
  // on, so routeReply settles the held connection instead.
  const hash = auth.requestHash(verified);
  const said = JSON.stringify({
    relay: 'device-answer', accepted: true, devicePublicKey: phone.publicKey,
  });
  box.routeReply(
    owner.publicKey, hash, said,
    auth.sign(owner.privateKey, auth.receiptMessage(hash))
  );

  const browser = await offering;
  if (browser && browser.ok && browser.devicePublicKey === phone.publicKey) {
    test.check("and the node's reply is what answers the browser that was waiting");
  } else {
    test.fail('browser: ' + JSON.stringify(browser));
  }

  test.subHeading('A no is a no, and an unreadable answer is also a no');

  const W2 = world.build(SCENARIO);
  if (!W2.ok) { test.fail(W2.error); return; }
  const home2 = W2.ownerHome();
  deviceAuth.ensurePassword(home2);
  const sink2 = fakeSink();
  W2.box.streamOpen(
    W2.owner.publicKey,
    auth.sign(W2.owner.privateKey, auth.streamMessage(W2.owner.publicKey)),
    sink2
  );

  async function answerWith(text) {
    const mark = sink2.events().length;
    const waiting = W2.box.deviceOffer('andy', deviceAuth.load(home2).password, 'pk-x');
    const ev = sink2.events().slice(mark).filter(function (e) { return e.event === 'request'; })[0];
    const v = auth.postSignatureFor(ev.data.from, ev.data.from, ev.data.to, ev.data.text, ev.data.sig);
    const h = auth.requestHash(v);
    W2.box.routeReply(
      W2.owner.publicKey, h, text,
      auth.sign(W2.owner.privateKey, auth.receiptMessage(h))
    );
    return waiting;
  }

  const refused = await answerWith(JSON.stringify({ relay: 'device-answer', accepted: false }));
  if (refused && refused.ok === false) {
    test.check('a node that says no leaves the browser refused');
  } else {
    test.fail('after a no: ' + JSON.stringify(refused));
  }

  // ANYTHING IT CANNOT READ IS A NO. A page told yes on the strength of
  // an answer nobody could parse would be enrolled against a node that
  // never agreed.
  const garbled = await answerWith('not a packet at all');
  if (garbled && garbled.ok === false) {
    test.check('and an answer it cannot read is refused rather than believed');
  } else {
    test.fail('after nonsense: ' + JSON.stringify(garbled));
  }

  // THE EMPTY RECEIPT IS NOT A YES. Every node already answers a request
  // with a bare receipt; a device offer must not read that as consent.
  const bare = await answerWith('');
  if (bare && bare.ok === false) {
    test.check('and a bare receipt — which every node sends — is not consent');
  } else {
    test.fail('a plain receipt enrolled a device: ' + JSON.stringify(bare));
  }

  test.subHeading('And a node holding no stream still gets the old road');

  // The poll has not gone. Until it does, a node that is not streaming
  // falls back to it rather than being told no on the strength of a road
  // that is merely the newer one.
  const W3 = world.build(SCENARIO);
  if (!W3.ok) { test.fail(W3.error); return; }
  const home3 = W3.ownerHome();
  deviceAuth.ensurePassword(home3);
  const pw3 = deviceAuth.load(home3).password;
  const parked = W3.box.deviceOffer('andy', pw3, 'pk-parked');
  const pending = W3.box.devicePending(
    W3.owner.publicKey,
    auth.sign(W3.owner.privateKey, deviceAuth.deviceTakeMessage('andy'))
  );
  if (pending && pending.password === pw3 && pending.devicePublicKey === 'pk-parked') {
    test.check('with nobody streaming the offer is parked, and the poll finds it');
  } else {
    test.fail('not parked: ' + JSON.stringify(pending));
  }
  W3.box.deviceReply('andy', false);
  await parked;
}

test.startTest('Device cycle 3 — listen and tick');

async function run() {
  const L = world.build(SCENARIO);
  const box = L.box;
  const house = L.owner;
  const phone = auth.generateIdentity('device');

  // THE OWNER'S NODE, which is not the relay's directory. The tick reads
  // an identity out of the home it is given and signs device-take with
  // it, and relay-state/identity.json inside a RELAY home is the
  // mailbox's own key, never the owner's (relay.js, mailboxPublicKey).
  //
  // This suite used to hand the tick the relay's home and it worked,
  // because the builder was wrongly saving the owner there. It is two
  // machines in production and it is two homes here.
  const home = L.ownerHome();

  if (L.ok) test.check('house owns the lab mailbox');
  else { test.fail(L.error); return; }

  const quiet = await deviceTick.tick(home, ['http://relay'], function () {
    return Promise.resolve({});
  });
  if (quiet && quiet.did === 'quiet') test.check('tick is inert when not listening');
  else test.fail('quiet: ' + JSON.stringify(quiet));

  deviceAuth.ensurePassword(home);
  deviceAuth.setListening(home, true);
  const doc = deviceAuth.load(home);
  if (doc.listening && doc.password) test.check('listening stored');
  else test.fail('doc: ' + JSON.stringify(doc));

  // B1: name first. Omitted resolves to the owner label, which is the
  // path today's device.html takes — exercised in deviceHandshakeTest.js.
  const offerP = box.deviceOffer('andy', doc.password, phone.publicKey);

  // The fifth argument is headers. The proof arrives there now, never on
  // the path — so this stands in for the route by reading it off the
  // header and handing it to the gated call, the way server.js does.
  async function requestFn(url, method, pth, body, headers) {
    if (method === 'GET' && /device-pending/.test(pth)) {
      if (/[?&]sig=/.test(pth)) {
        test.fail('the tick put a signature on the query string');
        return {};
      }
      const sig = (headers && (headers['X-Spirit-Sig'] || headers['x-spirit-sig'])) || '';
      const held = box.devicePending('andy', sig);
      return held || {};
    }
    if (method === 'POST' && /set-device/.test(pth)) {
      return box.setDevice(body.name, body.devicePublicKey, body.sig);
    }
    if (method === 'POST' && /device-answer/.test(pth)) {
      return box.deviceReply(body.name, !!body.accepted);
    }
    return { ok: false };
  }

  const did = await deviceTick.tick(home, ['http://relay'], requestFn);
  if (did && did.did === 'installed') test.check('tick installed the device');
  else test.fail('tick: ' + JSON.stringify(did));

  const browser = await offerP;
  if (browser && browser.ok) test.check('held POST completed');
  else test.fail('browser: ' + JSON.stringify(browser));

  const phoneInbox = box.inbox(
    'andy',
    auth.sign(phone.privateKey, auth.inboxMessage('andy'))
  );
  if (phoneInbox.ok) test.check('device can read after tick');
  else test.fail('inbox: ' + JSON.stringify(phoneInbox));

  deviceAuth.setListening(home, false);
  const after = await deviceTick.tick(home, ['http://relay'], requestFn);
  if (after && after.did === 'quiet') test.check('close window stops the tick');
  else test.fail('after: ' + JSON.stringify(after));

  // A second world, not a second door onto the first. The refusal being
  // checked is "this password is wrong", and it is only worth anything if
  // the door it was offered to was open and ready to accept a right one.
  const W = world.build(SCENARIO);
  if (!W.ok) { test.fail(W.error); return; }
  const wrongHome = W.ownerHome();
  const wrongBox = W.box;
  deviceAuth.ensurePassword(wrongHome);
  deviceAuth.setListening(wrongHome, true);
  const live = deviceAuth.load(wrongHome).password;
  const offerWrong = wrongBox.deviceOffer(
    'andy',
    live.split('').reverse().join(''),
    phone.publicKey
  );

  async function rejectFn(url, method, pth, body, headers) {
    if (method === 'GET' && /device-pending/.test(pth)) {
      const sig = (headers && (headers['X-Spirit-Sig'] || headers['x-spirit-sig'])) || '';
      return wrongBox.devicePending('andy', sig) || {};
    }
    if (method === 'POST' && /set-device/.test(pth)) {
      test.fail('setDevice must not run on a wrong password');
      return { ok: false };
    }
    if (method === 'POST' && /device-answer/.test(pth)) {
      return wrongBox.deviceReply(body.name, !!body.accepted);
    }
    return { ok: false };
  }

  const rejected = await deviceTick.tick(wrongHome, ['http://relay'], rejectFn);
  if (rejected && rejected.did === 'rejected') test.check('wrong password is rejected');
  else test.fail('rejected: ' + JSON.stringify(rejected));

  const browserNo = await offerWrong;
  if (browserNo && browserNo.ok === false && browserNo.error === 'not now') {
    test.check('browser also sees not now');
  } else {
    test.fail('browserNo: ' + JSON.stringify(browserNo));
  }

  await oneDeviceEveryMailbox();
  await theRelayPostsAsItself();
  await bootBehaviour();

  if (typeof test.reportSuccessFailureCount === 'function') {
    test.reportSuccessFailureCount();
  }
}

// The window has to survive a restart. Until now the flag persisted and
// nothing read it at startup, so every restart shut the door silently —
// and the owner of that door is routinely nowhere near the machine.
async function bootBehaviour() {
  test.subHeading('The window survives a restart');

  // An older device.json has no `listening` field. Absent means nobody
  // decided, and the default that cannot strand anybody is open.
  const bare = tmpHome();
  fs.mkdirSync(path.join(bare, 'relay-state'), { recursive: true });
  fs.writeFileSync(
    path.join(bare, 'relay-state', 'device.json'),
    JSON.stringify({ password: 'x'.repeat(deviceAuth.PASSWORD_HEX_LEN), devicePublicKey: null })
  );
  if (deviceAuth.load(bare).listening === true) {
    test.check('a file with no listening field reads as open');
  } else {
    test.fail('bare doc: ' + JSON.stringify(deviceAuth.load(bare)));
  }

  // Written down, and honoured. The switch has to mean something or it is
  // chrome.
  deviceAuth.setListening(bare, false);
  if (deviceAuth.load(bare).listening === false) {
    test.check('and an explicit false is kept, so the switch still shuts it');
  } else {
    test.fail('after setListening(false): ' + JSON.stringify(deviceAuth.load(bare)));
  }

  // Shut is shut: boot must not reopen a door somebody closed on purpose.
  const shut = createHub(bare);
  const shutUrls = await shut.resumeListening();
  if (Array.isArray(shutUrls) && shutUrls.length === 0 && !listeningOf(shut)) {
    test.check('and resuming a shut window starts nothing');
  } else {
    test.fail('shut resume: ' + JSON.stringify(shutUrls) + ' listening=' + listeningOf(shut));
  }

  // Default-on costs nothing on a node nobody has configured: the door
  // needs a password to open, and a timer whose every pass is a no-op is
  // noise on every fake peer in the lab.
  const fresh = tmpHome();
  const freshHub = createHub(fresh);
  await freshHub.resumeListening();
  if (!listeningOf(freshHub)) {
    test.check('and a node with no password starts nothing, though it defaults open');
  } else {
    test.fail('a passwordless node started a timer');
  }

  // The case this exists for: the flag says open, a password exists, the
  // process restarts. The door comes back by itself.
  const kept = tmpHome();
  auth.saveIdentity(kept, auth.generateIdentity('andy'));
  deviceAuth.ensurePassword(kept);
  deviceAuth.setListening(kept, true);
  const keptHub = createHub(kept);
  await keptHub.resumeListening();
  if (listeningOf(keptHub)) {
    test.check('but a window left open comes back open after a restart');
  } else {
    test.fail('a kept-open window did not resume');
  }

  // AT ONCE, not one tick later. setInterval alone puts the first pass a
  // whole DEVICE_TICK_MS after the window opens, and that is the one gap
  // the rendezvous rule cannot cover: a hold that outlasts a pass still
  // cannot outlast a pass that has not started. It matters most in the
  // order a person actually uses — open the relay page on the phone
  // first, then start listening at home.
  //
  // Asserted on the EVENT rather than on a timer, because the event is
  // what the panel shows and what proved the poll was alive on spirit-3.
  await settle();
  const first = lastEventOf(keptHub);
  if (first && first.did) {
    test.check('and it looks straight away rather than a minute later — first pass: ' + first.did);
  } else {
    test.fail('no pass had happened by the time the window was open');
  }
}

// Long enough for a pass with no relays to fall through deviceTick and
// land in deviceLastEvent; far short of a tick, so passing here cannot
// mean the interval fired.
function settle() {
  return new Promise(function (resolve) { setTimeout(resolve, 250); });
}

// What /api/hub/device reports, which is the TIMER and not the file — the
// live answer, so the panel cannot claim to be listening while nothing is.
function lastEventOf(hub) {
  let body = '';
  hub.handleDevice({}, {
    writeHead: function () {},
    end: function (text) { body = text; },
  });
  try { return JSON.parse(body).lastEvent; }
  catch (e) { return null; }
}

function listeningOf(hub) {
  let body = '';
  hub.handleDevice({}, {
    writeHead: function () {},
    end: function (text) { body = text; },
  });
  try { return JSON.parse(body).listening === true; }
  catch (e) { return false; }
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  if (typeof test.reportSuccessFailureCount === 'function') {
    test.reportSuccessFailureCount();
  }
});
