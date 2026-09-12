'use strict';

// spirit/test/deviceEnrol.js
// Enrolling a browser, end to end, with no poll anywhere in it.
//
// This was deviceListen.js — "listening flag + one tick installs the
// slot" — and both halves of that sentence are gone. There is no flag and
// there is no tick. What is left is the thing they were scaffolding for:
// a relay posts an offer to a node on the stream it is already holding,
// the node compares the password it alone knows, installs the key on
// every relay it has a row on, and answers. One round trip.
//
// The suite is in that order: the post, the decision, the fan-out, and
// what the node's own panel is told about any of it.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const deviceAuth = require('../run/js/deviceAuth');
const deviceTick = require('../run/js/deviceTick');
const world = require('./world');
const { createHub } = require('../run/js/hub');

// An owner, a relay, and nobody else.
const SCENARIO = require('./scenario').OWNER_ONLY;

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

// A NODE ON THE WIRE. Since the poll went this is the only way an offer
// reaches anybody — there is no second road and nothing parks.
function streaming(box, id) {
  const sink = fakeSink();
  const opened = box.streamOpen(
    id.publicKey,
    auth.sign(id.privateKey, auth.streamMessage(id.publicKey)),
    sink
  );
  return { sink: sink, opened: opened, mark: sink.events().length };
}

// The last request to land on this sink, and what it carried.
function offerOn(held) {
  const arrived = held.sink.events().slice(held.mark)
    .filter(function (e) { return e.event === 'request'; });
  held.mark = held.sink.events().length;
  if (!arrived.length) return null;
  const req = arrived[arrived.length - 1].data;
  let carried = null;
  try { carried = JSON.parse(req.text); } catch (e) { carried = null; }
  return { req: req, carried: carried };
}

// The node answering. This is the one asymmetry in the router: the relay
// holds no stream to itself, so routeReply settles the browser's held
// POST instead of pushing the answer down a socket.
function replyTo(box, id, req, text) {
  const hash = auth.requestHash(
    auth.postSignatureFor(req.from, req.from, req.to, req.text, req.sig)
  );
  return box.routeReply(
    id.publicKey, hash, text,
    auth.sign(id.privateKey, auth.receiptMessage(hash))
  );
}

// What answerRelay.js puts on the wire once deviceTick has decided. Two
// lines rather than the module itself, because answerRelay.js has its own
// suite and what is under test here is the decision and the road.
function answerText(decided) {
  return JSON.stringify({
    relay: 'device-answer',
    accepted: !!decided.accepted,
    devicePublicKey: decided.accepted ? decided.devicePublicKey : '',
  });
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
  const held = streaming(box, owner);
  if (!held.opened || held.opened.ok === false) {
    test.fail('the node could not hold a stream: ' + JSON.stringify(held.opened));
    return;
  }

  const offering = box.deviceOffer('andy', password, phone.publicKey);
  const got = offerOn(held);

  // NOT A DEVICE EVENT. The same `request` a peer's post arrives as, so
  // the node needs no second reader and no second rule.
  if (got) {
    test.check('it arrives as a `request`, the same event any post arrives as');
  } else {
    test.fail('nothing arrived on the stream');
    return;
  }

  const req = got.req;

  // SIGNED BY THE RELAY, which is the whole point. A device page has no
  // identity yet — that is what it is enrolling — so there is no
  // end-to-end signature to carry, and the relay vouching for it is the
  // only attestation there can be.
  const mailboxKey = box.snapshot().mailboxPublicKey;
  const verified = auth.postSignatureFor(req.from, req.from, req.to, req.text, req.sig);
  if (req.from === mailboxKey && verified) {
    test.check('signed by the relay itself, and it verifies against the relay key');
  } else {
    test.fail('signature: from=' + String(req.from).slice(-12) +
      ' relay=' + String(mailboxKey).slice(-12) + ' verified=' + !!verified);
  }

  // The node must be able to tell the relay apart from anybody else, and
  // the census is where it learns that key — no new endpoint.
  if (mailboxKey && req.to === owner.publicKey) {
    test.check('and addressed to the identity being enrolled, from a key the census publishes');
  } else {
    test.fail('addressing: to=' + req.to);
  }

  // The payload is an ordinary packet, so the node routes it the way it
  // routes anything.
  const carried = got.carried;
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
  replyTo(box, owner, req, answerText({
    accepted: true, devicePublicKey: phone.publicKey,
  }));

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
  const held2 = streaming(W2.box, W2.owner);

  async function answerWith(text) {
    const waiting = W2.box.deviceOffer('andy', deviceAuth.load(home2).password, 'pk-x');
    const asked = offerOn(held2);
    replyTo(W2.box, W2.owner, asked.req, text);
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

  test.subHeading('A node holding no stream is refused, at once');

  // THE BACKSTOP IS GONE, and this is the check that says so. An offer to
  // a node that is not there used to be parked for the next poll; now
  // post() draws the same line it draws for every other post — deliver or
  // refuse, decision 0006 — and the browser is told immediately rather
  // than left holding a connection for a minute.
  const W3 = world.build(SCENARIO);
  if (!W3.ok) { test.fail(W3.error); return; }
  deviceAuth.ensurePassword(W3.ownerHome());
  const began = Date.now();
  const away = await W3.box.deviceOffer(
    'andy', deviceAuth.load(W3.ownerHome()).password, 'pk-away'
  );
  if (away && away.ok === false && away.error === 'not now') {
    test.check('with nobody streaming the offer is refused, not parked');
  } else {
    test.fail('absent node: ' + JSON.stringify(away));
  }
  // And refused NOW. The old road held the browser for 66 seconds to
  // outlast a 60-second poll; this is the number that replaced it.
  if (Date.now() - began < 1000) {
    test.check('and refused at once — ' + (Date.now() - began) + 'ms, against 66 seconds of holding');
  } else {
    test.fail('the refusal took ' + (Date.now() - began) + 'ms');
  }

  test.subHeading('And a flood is still a flood');

  // THE RATE LIMIT CAME BACK WITH THE DEMOLITION, and this is the check
  // that it did. It lived in deviceHandshake.js, which is gone — and
  // /api/relay/device is a public POST carrying a password guess that now
  // costs a post to somebody's node as well. Losing the ceiling here
  // would have been silent: nothing else in the suite counts attempts.
  //
  // The absent node above is reused deliberately. Every one of these is
  // refused for being unreachable, so what changes at the eleventh is the
  // limit and nothing else.
  const codes = [];
  for (let n = 0; n < 12; n += 1) {
    /* eslint-disable no-await-in-loop */
    const r = await W3.box.deviceOffer('andy', 'x'.repeat(64), 'pk-flood');
    codes.push(r && r.status);
  }
  // One was already spent above, so the tenth of these is the last one
  // through.
  if (codes.indexOf(429) !== -1 && codes[codes.length - 1] === 429) {
    test.check('ten attempts a minute per identity, and the eleventh is 429');
  } else {
    test.fail('statuses: ' + JSON.stringify(codes));
  }

  // AND IT IS THE ONE REFUSAL NAMED PRECISELY. Everything else says `not
  // now` on purpose; this one is temporary, and a page that can tell the
  // difference waits rather than telling somebody their password is
  // wrong.
  const flooded = await W3.box.deviceOffer('andy', 'x'.repeat(64), 'pk-flood');
  if (flooded.status === 429 && flooded.error !== 'not now') {
    test.check('and it says so, which is what makes the page wait rather than give up');
  } else {
    test.fail('flooded: ' + JSON.stringify(flooded));
  }

  // PER IDENTITY, not per relay. One person being hammered must not lock
  // everybody else on the box out of enrolling.
  const other = world.build({ title: 'flood', peers: ['carol'] });
  if (!other.ok) { test.fail(other.error); return; }
  const carol = await other.box.deviceOffer(
    other.peer('carol').publicKey, 'x'.repeat(64), 'pk-c'
  );
  if (carol && carol.status !== 429) {
    test.check('and the bucket is per identity — one flood does not shut the relay');
  } else {
    test.fail('carol: ' + JSON.stringify(carol));
  }
}

// A DEVICE BELONGS TO THE IDENTITY, NOT TO THE MAILBOX THAT ENROLLED IT.
//
// Andy attached a browser to a lab peer who was on two relays, and it
// worked — on one of them. The exchange happens wherever the password was
// typed, and the key was installed only there, so the enrolled browser
// could read one relay's row and was a stranger to the other. That is not
// what "add this device" says.
//
// Two relays, one identity on both, the offer arriving on the SECOND —
// deliberately not the first, because installing on "the one that had the
// offer" and installing on "the first in the list" look identical in a
// world where those are the same relay.
async function oneDeviceEveryRelay() {
  test.subHeading('A device enrolled on one relay works on all of them');

  const W = world.build({
    title: 'An owner with a row on two relays',
    relays: ['lab', 'other'],
    peers: [],
  });
  if (!W.ok) { test.fail(W.error); return; }

  const first = W.relay('lab');
  const second = W.relay('other');
  const owner = W.owner;
  const home = W.ownerHome();
  const urls = ['http://first', 'http://second'];
  const boxFor = { 'http://first': first, 'http://second': second };
  const phone = auth.generateIdentity('device');

  deviceAuth.ensurePassword(home);
  const password = deviceAuth.load(home).password;

  const setDeviceHits = [];
  async function requestFn(url, method, pth, body) {
    const box = boxFor[url];
    if (!box) return { ok: false, error: 'unreachable' };
    if (method === 'POST' && /set-device/.test(pth)) {
      setDeviceHits.push(url);
      return box.setDevice(body.name, body.devicePublicKey, body.sig);
    }
    return { ok: false };
  }

  // The browser knocks on the SECOND relay, and the node is streaming on
  // it — which is how the offer reaches the node at all.
  const held = streaming(second, owner);
  const offering = second.deviceOffer('andy', password, phone.publicKey);
  const got = offerOn(held);
  if (!got) { test.fail('the offer never reached the node'); return; }

  const did = await deviceTick.answerOffer(
    home, urls, got.carried, requestFn, 'http://second'
  );
  replyTo(second, owner, got.req, answerText(did));
  const browser = await offering;

  if (did && did.accepted) {
    test.check('the node takes the offer that arrived, whichever relay carried it');
  } else {
    test.fail('decided: ' + JSON.stringify(did));
  }

  if (browser && browser.ok) {
    test.check('and the browser waiting on THAT relay is answered by it');
  } else {
    test.fail('browser: ' + JSON.stringify(browser));
  }

  // THE ENROLLING RELAY FIRST, so the one the person is standing in front
  // of holds the key by the time they are told yes.
  if (setDeviceHits[0] === 'http://second') {
    test.check('and it is told first, before the ones nobody is looking at');
  } else {
    test.fail('order: ' + JSON.stringify(setDeviceHits));
  }

  // THE WHOLE POINT, and PROVED BY USE rather than by reading a field off
  // a row. who() deliberately does not publish device keys — they are
  // nobody else's business — so there is nothing to inspect, and a read
  // the relay accepts is a better claim than a field anyway.
  const readFirst = first.inbox('andy', auth.sign(phone.privateKey, auth.inboxMessage('andy')));
  const readSecond = second.inbox('andy', auth.sign(phone.privateKey, auth.inboxMessage('andy')));
  if (readFirst.ok && readSecond.ok) {
    test.check('and the enrolled browser reads BOTH, not only the enrolling one');
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

  // Said out loud, because a device on two relays out of three is a
  // device that fails somewhere the person has no reason to expect.
  if ((did.installedOn || []).length === 2 && (did.missedOn || []).length === 0) {
    test.check('and the decision says which relays took it, and which did not');
  } else {
    test.fail('spread: ' + JSON.stringify({ on: did.installedOn, missed: did.missedOn }));
  }

  // A RELAY THAT IS DOWN MUST NOT SINK THE ENROLMENT. The browser is
  // standing in front of one relay; another being unreachable is this
  // node's bookkeeping and not that person's problem.
  const W2 = world.build({ relays: ['lab', 'other'], peers: [] });
  if (!W2.ok) { test.fail(W2.error); return; }
  const live = W2.relay('lab');
  const home2 = W2.ownerHome();
  deviceAuth.ensurePassword(home2);
  const phone2 = auth.generateIdentity('device2');

  async function halfDown(url, method, pth, body) {
    if (url === 'http://down') return { ok: false, error: 'unreachable' };
    if (method === 'POST' && /set-device/.test(pth)) {
      return live.setDevice(body.name, body.devicePublicKey, body.sig);
    }
    return { ok: false };
  }

  const held2 = streaming(live, W2.owner);
  const offering2 = live.deviceOffer('andy', deviceAuth.load(home2).password, phone2.publicKey);
  const got2 = offerOn(held2);
  const partial = await deviceTick.answerOffer(
    home2, ['http://up', 'http://down'], got2.carried, halfDown, 'http://up'
  );
  replyTo(live, W2.owner, got2.req, answerText(partial));
  const browser2 = await offering2;

  if (partial.accepted && browser2 && browser2.ok &&
      (partial.missedOn || []).indexOf('http://down') !== -1) {
    test.check('and one unreachable relay does not fail the enrolment — it is named instead');
  } else {
    test.fail('partial: ' + JSON.stringify(partial) + ' browser=' + JSON.stringify(browser2));
  }

  if (deviceAuth.load(home2).devicePublicKey === phone2.publicKey) {
    test.check('and the node records the device, because somewhere took it');
  } else {
    test.fail('node did not record a device that one relay holds');
  }
}

// A PEER'S DEVICE IS THE PEER'S, and the page has to be told whose it is.
//
// The answer carried `snapshot().owner` — this RELAY's owner — so every
// device page on a box came back "signed in as andy", bella's included.
// Andy caught it the first time two enrolments ran back to back, and it
// was sitting in the output of the live test twice before that, in a
// line I read past: {"ok":true,...,"name":"andy"} for BELLA.
//
// True when it was written. The bare /device page enrolled the owner and
// nobody else, so the owner's label was the only answer there was. B2
// gave every identity with a row its own /<key>/device page and its own
// enrolment, and this line did not follow — a fact that stopped being
// true without anything going red.
//
// IT NEEDS A PEER TO CATCH IT. With the owner enrolling, "the relay's
// owner" and "who was enrolled" are the same string, and a test built
// that way passes against the bug.
async function aPeerIsNamedAsThemselves() {
  test.subHeading("A peer's enrolment says the peer, not the relay's owner");

  const W = world.build({ title: 'An owner and a member', peers: ['bert'] });
  if (!W.ok) { test.fail(W.error); return; }

  const bert = W.peer('bert');
  const home = world.tmpHome('bert-device');
  auth.saveIdentity(home, bert);
  deviceAuth.ensurePassword(home);
  const password = deviceAuth.load(home).password;
  const phone = auth.generateIdentity('berts-phone');

  const held = streaming(W.box, bert);
  const offering = W.box.deviceOffer(bert.publicKey, password, phone.publicKey);
  const got = offerOn(held);
  if (!got) { test.fail('no request reached bert'); return; }

  replyTo(W.box, bert, got.req, answerText({
    accepted: true, devicePublicKey: phone.publicKey,
  }));

  const browser = await offering;
  if (browser && browser.ok && browser.name === 'bert') {
    test.check('the page is told it is signed in as bert, whose device it is');
  } else {
    test.fail('name: ' + JSON.stringify(browser && browser.name) +
      ' (the relay owner is ' + (W.box.snapshot() || {}).owner + ')');
  }

  // And said out loud, because this is the shape of the bug: the two
  // must not be the same string in this test, or it proves nothing.
  if ((W.box.snapshot() || {}).owner === 'andy' && browser.name === 'bert') {
    test.check('and the relay owner is somebody else entirely, which is the point');
  } else {
    test.fail('the test cannot tell the two apart');
  }
}

// WHAT THE PANEL IS TOLD, which since the poll went is two facts.
//
// It reported `listening` and `lastEvent` — whether the timer was running
// and what its last pass did — and both described a mechanism rather than
// a state. There is no pass. A node with a password can be enrolled to,
// and there is nothing else about that worth saying.
//
// Checked here because the natter panel is built on this answer, and a
// field that quietly came back would put a switch back on the page.
function whatThePanelIsTold() {
  test.subHeading('What the node tells its own panel');

  const home = world.tmpHome('panel');
  const me = auth.generateIdentity('andy');
  auth.saveIdentity(home, me);
  const hub = createHub(home);

  let body = '';
  hub.handleDevice({}, {
    writeHead: function () {},
    end: function (text) { body = text; },
  });
  let said = null;
  try { said = JSON.parse(body); } catch (e) { said = null; }

  if (said && said.password && said.password.length === deviceAuth.PASSWORD_HEX_LEN) {
    test.check('a password, minted on first ask so the page always has one');
  } else {
    test.fail('password: ' + JSON.stringify(said && said.password));
  }

  if (said && said.publicKey === me.publicKey) {
    test.check("and this node's own key, which is what the per-key link is built from");
  } else {
    test.fail('publicKey: ' + JSON.stringify(said && said.publicKey));
  }

  if (said && !('listening' in said) && !('lastEvent' in said) && !('relayUrls' in said)) {
    test.check('and nothing about a window, a pass, or a timer — there is none');
  } else {
    test.fail('the panel is still told about a poll: ' + body);
  }

  // The same call twice hands back the same password. The page is opened
  // and reopened; a fresh secret each time would mean the one on screen
  // and the one the node compares were never the same.
  let again = '';
  hub.handleDevice({}, { writeHead: function () {}, end: function (t) { again = t; } });
  if (again === body) {
    test.check('and asking twice gives the same answer, not a new secret');
  } else {
    test.fail('the password changed between reads');
  }

  // ON DISK AND NOWHERE ELSE. relay-state/ is gitignored and unservable;
  // the check is that the password is in the file the node reads and in
  // no relay's state.
  const onDisk = JSON.parse(
    fs.readFileSync(path.join(home, 'relay-state', 'device.json'), 'utf8')
  );
  if (onDisk.password === said.password && !('listening' in onDisk)) {
    test.check('and device.json holds the password and no flag beside it');
  } else {
    test.fail('device.json: ' + JSON.stringify(onDisk));
  }
}

test.startTest('Device enrolment — one round trip, no poll');

async function run() {
  const L = world.build(SCENARIO);
  if (!L.ok) { test.fail(L.error); test.reportSuccessFailureCount(); return; }
  const box = L.box;
  const phone = auth.generateIdentity('device');

  // THE OWNER'S NODE, which is not the relay's directory.
  // relay-state/identity.json inside a RELAY home is the relay's own key,
  // never the owner's (relay.js, mailboxPublicKey). It is two machines in
  // production and it is two homes here.
  const home = L.ownerHome();
  test.check('house owns the lab relay');

  deviceAuth.ensurePassword(home);
  const password = deviceAuth.load(home).password;

  async function requestFn(url, method, pth, body) {
    if (method === 'POST' && /set-device/.test(pth)) {
      return box.setDevice(body.name, body.devicePublicKey, body.sig);
    }
    return { ok: false };
  }

  const held = streaming(box, L.owner);
  const offering = box.deviceOffer('andy', password, phone.publicKey);
  const got = offerOn(held);
  const did = await deviceTick.answerOffer(
    home, ['http://relay'], got.carried, requestFn, 'http://relay'
  );
  replyTo(box, L.owner, got.req, answerText(did));

  if (did && did.accepted) test.check('the right password installs the device');
  else test.fail('decided: ' + JSON.stringify(did));

  const browser = await offering;
  if (browser && browser.ok) test.check('and the held POST completes');
  else test.fail('browser: ' + JSON.stringify(browser));

  const phoneInbox = box.inbox(
    'andy',
    auth.sign(phone.privateKey, auth.inboxMessage('andy'))
  );
  if (phoneInbox.ok) test.check('and the device can read from then on');
  else test.fail('inbox: ' + JSON.stringify(phoneInbox));

  // A second world, not a second door onto the first. The refusal being
  // checked is "this password is wrong", and it is only worth anything if
  // the door it was offered to was one a right password would have
  // opened.
  const W = world.build(SCENARIO);
  if (!W.ok) { test.fail(W.error); test.reportSuccessFailureCount(); return; }
  const wrongHome = W.ownerHome();
  deviceAuth.ensurePassword(wrongHome);
  const live = deviceAuth.load(wrongHome).password;

  async function rejectFn(url, method, pth) {
    if (method === 'POST' && /set-device/.test(pth)) {
      test.fail('setDevice must not run on a wrong password');
      return { ok: false };
    }
    return { ok: false };
  }

  const heldW = streaming(W.box, W.owner);
  const offerWrong = W.box.deviceOffer(
    'andy', live.split('').reverse().join(''), phone.publicKey
  );
  const gotW = offerOn(heldW);
  const rejected = await deviceTick.answerOffer(
    wrongHome, ['http://relay'], gotW.carried, rejectFn, 'http://relay'
  );
  replyTo(W.box, W.owner, gotW.req, answerText(rejected));

  if (rejected && rejected.accepted === false && rejected.why === 'wrong password') {
    test.check('a wrong password is rejected, and says so to itself');
  } else {
    test.fail('rejected: ' + JSON.stringify(rejected));
  }

  const browserNo = await offerWrong;
  if (browserNo && browserNo.ok === false && browserNo.error === 'not now') {
    test.check('and the browser is told only `not now`, which is all it is owed');
  } else {
    test.fail('browserNo: ' + JSON.stringify(browserNo));
  }

  await theRelayPostsAsItself();
  await oneDeviceEveryRelay();
  await aPeerIsNamedAsThemselves();
  whatThePanelIsTold();

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
