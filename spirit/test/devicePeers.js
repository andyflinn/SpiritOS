'use strict';

// spirit/test/devicePeers.js
// B2. One device for ANYONE with a row, not only the owner.
//
// The thing this exists to prove is the one B1 could not: two peers
// wearing the SAME LABEL and different keys are two identities, and the
// device flow must never confuse them. Labels duplicate on purpose —
// relay.js says it at the claim path, "two johns is still two keys" —
// so a slot keyed by label cannot tell them apart, and the id is the
// public key instead.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const deviceAuth = require('../run/js/deviceAuth');
const world = require('./world');
const deviceTick = require('../run/js/deviceTick');

// WHAT A HELD STREAM LOOKS LIKE from the relay's side. The same sink
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

// A NODE STANDING ON THE RELAY'S STREAM, which since the poll went is the
// only way an offer reaches anybody at all. There is no slot to park one
// in and no second road to it.
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

// The node answering, which is what settles the browser's held POST —
// the one asymmetry in the router, because a relay holds no stream to
// itself and its far end is a connection instead.
function replyTo(box, id, req, accepted, deviceKey) {
  const hash = auth.requestHash(
    auth.postSignatureFor(req.from, req.from, req.to, req.text, req.sig)
  );
  return box.routeReply(
    id.publicKey, hash,
    JSON.stringify({
      relay: 'device-answer',
      accepted: !!accepted,
      devicePublicKey: deviceKey || '',
    }),
    auth.sign(id.privateKey, auth.receiptMessage(hash))
  );
}

// TWO JOHNS, and the scenario says so in one line. Both wear the label
// `john`; neither can share a name, because a name is how this suite
// refers to somebody and a label is what goes on the wire. That
// distinction is the whole subject of this file.
const SCENARIO = {
  title: 'Two peers wearing one label',
  peers: [
    { name: 'johnA', label: 'john' },
    { name: 'johnB', label: 'john' },
  ],
};

test.startTest('Device B2 — a device for any identity');

// The owner mints an invite for each, which is the only way a second key
// wearing a label already on the box gets on it — world.build does that
// for every peer in the scenario.

async function run() {
  const L = world.build(SCENARIO);
  if (!L.ok) { test.fail(L.error); test.reportSuccessFailureCount(); return; }

  const johnA = L.peer('johnA');
  const johnB = L.peer('johnB');
  if (johnA.publicKey !== johnB.publicKey) {
    test.check('two peers share a label and differ by key');
  } else {
    test.fail('the two johns got the same key');
  }

  test.subHeading('Each john is offered to on their own stream');

  const phoneA = auth.generateIdentity('phone-a');
  const phoneB = auth.generateIdentity('phone-b');

  // BOTH JOHNS ARE HOME. There is no slot any more — an offer is posted
  // to the node on the stream it is already holding — so "each john gets
  // their own" is now a statement about which SOCKET it went down, which
  // is a stronger claim than which slot it landed in.
  const heldA = streaming(L.box, johnA);
  const heldB = streaming(L.box, johnB);
  if (heldA.opened.ok && heldB.opened.ok) {
    test.check('both johns hold a stream, each signed as themselves');
  } else {
    test.fail('streams: ' + JSON.stringify([heldA.opened, heldB.opened]));
  }

  // Addressed by KEY, which is what the per-key URL carries.
  const offerA = L.box.deviceOffer(johnA.publicKey, 'pw-a', phoneA.publicKey);
  const offerB = L.box.deviceOffer(johnB.publicKey, 'pw-b', phoneB.publicKey);

  const gotA = offerOn(heldA);
  const gotB = offerOn(heldB);
  if (gotA && gotA.carried && gotA.carried.password === 'pw-a' &&
      gotB && gotB.carried && gotB.carried.password === 'pw-b') {
    test.check('each hears its own offer, though the labels are identical');
  } else {
    test.fail('A: ' + JSON.stringify(gotA && gotA.carried) +
      ' B: ' + JSON.stringify(gotB && gotB.carried));
  }

  // And not the other's — the check above would pass if both sinks got
  // both, which is exactly the confusion a label-keyed route would cause.
  if (gotA.req.to === johnA.publicKey && gotB.req.to === johnB.publicKey) {
    test.check('and only its own — the address on the wire is the key');
  } else {
    test.fail('addressing: ' + JSON.stringify([gotA.req.to, gotB.req.to]));
  }

  // The label is ambiguous, so it must resolve to nobody rather than to
  // whichever john happens to be first — the same answer resolveParty
  // gives the inbox, and the reason a duplicate label 409s there.
  const byLabel = await L.box.deviceOffer('john', 'pw-x', 'pk-x');
  if (byLabel && byLabel.ok === false) {
    test.check('and the shared label reaches neither of them');
  } else {
    test.fail('a duplicate label resolved: ' + JSON.stringify(byLabel));
  }

  test.subHeading('Enrolment binds a device to its NODE, and to no relay');

  // ── WHAT THIS SECTION USED TO SAY ────────────────────────────────────
  //
  // Three checks stood here about installing a device key ON THE RELAY —
  // that a peer could install on its own row, that another peer could
  // not, and that the owner could not install on a peer's.
  //
  // A relay does not hold a device key any more, so none of the three is
  // a question. Andy:
  //
  //   "the device key is used to mirror/fake the protocol for the one leg
  //   of the route where it's not actually compliant... and to safely tie
  //   a device to its node."
  //
  // Both jobs are the NODE's. The relay is a conduit that carries the
  // browser's offer and learns whether it was accepted. What is asserted
  // here now is the binding itself, and the absence of any copy.
  {
    const N = world.build(require('./scenario').OWNER_ONLY);
    if (!N.ok) { test.fail(N.error); return; }
    const home = N.ownerHome();
    const phone = auth.generateIdentity('handheld');
    deviceAuth.ensurePassword(home);

    const decided = await deviceTick.answerOffer(home, {
      password: deviceAuth.load(home).password,
      devicePublicKey: phone.publicKey,
    });

    if (decided && decided.accepted &&
        deviceAuth.load(home).devicePublicKey === phone.publicKey) {
      test.check('the right password binds the device to the node, in the node\'s own file');
    } else {
      test.fail('binding: ' + JSON.stringify(decided));
    }

    // THE PASSWORD IS THE WHOLE GATE, and it is compared in one place —
    // here, on the node. The relay never learns whether it matched.
    const wrong = await deviceTick.answerOffer(home, {
      password: 'not-the-password',
      devicePublicKey: auth.generateIdentity('other').publicKey,
    });
    if (wrong && wrong.accepted === false &&
        deviceAuth.load(home).devicePublicKey === phone.publicKey) {
      test.check('and a wrong password binds nothing, leaving the one that is there');
    } else {
      test.fail('wrong password: ' + JSON.stringify(wrong));
    }

    // ONE SLOT. The next enrolment REPLACES the last — which is what
    // makes a stolen password noticeable, and what makes "disconnect them
    // ALL" a single write rather than an enumeration.
    const second = auth.generateIdentity('tablet');
    await deviceTick.answerOffer(home, {
      password: deviceAuth.load(home).password,
      devicePublicKey: second.publicKey,
    });
    if (deviceAuth.load(home).devicePublicKey === second.publicKey) {
      test.check('a second enrolment replaces the first — one device per peer, by shape');
    } else {
      test.fail('slot: ' + JSON.stringify(deviceAuth.load(home)));
    }

    // AND NO RELAY KEPT A COPY. This is the check the whole change rests
    // on: nothing to strand on a relay that was unreachable, nothing to
    // reconcile, nothing held on somebody's behalf.
    const onDisk = fs.readFileSync(
      path.join(N.home, 'relay-state', 'allow.json'), 'utf8');
    const rowsHaveDevice = /devicePublicKey/.test(onDisk) ||
      N.box.who().some(function (r) { return r.devicePublicKey; });
    if (!rowsHaveDevice) {
      test.check('and no relay holds a copy — the binding exists in exactly one place');
    } else {
      test.fail('a relay kept a device key: ' + onDisk);
    }
  }

  test.subHeading('A device is the owner\'s window, not the owner\'s credentials');

  // WHAT A DEVICE MAY DO, and what it may NOT, which nothing tested until
  // 2026-09-12. It survived because no suite asked: relayAuth's own
  // comment called it "the decision, not an oversight" — "a device key is
  // a full copy of the owner's authority on this box" — and the reasoning
  // was that being the owner from a hotel room is the point of a device.
  //
  // Andy, shown what that actually reached: "needs fixing."
  //
  // It reached ADMIN. checkOwner took either key, so a device could read
  // the owner-only report; and the console decided owner powers from the
  // ROW rather than the signer, so a device got `status peers search
  // invites key version` — and `invites` lists LIVE TOKENS. A seized
  // phone could hand out access to the relay.
  //
  // The split now: a device keeps what a device is for, and loses the
  // power to administer the box.
  {
    const D = world.build(require('./scenario').OWNER_ONLY);
    if (!D.ok) { test.fail(D.error); return; }
    const handheld = auth.generateIdentity('handheld');

    // A DEVICE PROVES NOTHING TO A RELAY, and that is the whole of it
    // now. This check read the other way until 2026-09-13 — "a device
    // still reads and sends its owner's mail, that is what it is for" —
    // on the strength of two gates that honoured a device key.
    //
    // Nothing ever used them. No app, no shell, no device page:
    // device.html's own sendMessage helper had one occurrence in the
    // tree, its own definition. They were the last trace of a design
    // where the ring was how everything moved.
    //
    // A device's correspondent is the node that owns it. It speaks to a
    // relay exactly once, to be enrolled, and the relay carries that to
    // the node without learning the answer.
    const read = D.box.inbox('andy', auth.sign(handheld.privateKey, auth.inboxMessage('andy')));
    const sent = D.box.send(
      'andy', 'andy', 'from the handheld',
      auth.sign(handheld.privateKey, auth.sendMessage('andy', 'andy', 'from the handheld'))
    );
    if (read.ok === false && sent.ok === false) {
      test.check('a device key proves nothing to a relay — not a read, not a send');
    } else {
      test.fail('read=' + read.ok + ' send=' + sent.ok);
    }

    // ── CONFINED: A DEVICE REACHES ITS OWN IDENTITY AND NOTHING ELSE ──
    //
    // Andy: "i don't want the relay to allow a device posting to anybody
    // but its owner node, and i know that is cheap. and i know that if a
    // relay allows device post to target peers other than its owner's
    // node, it must end in failure anyway."
    //
    // The second half is the argument. A peer receiving that has no way
    // to tell a DEVICE composed it — it sees the owner's label and a
    // signature it cannot attribute. So allowing it enables no feature;
    // it permits a guaranteed failure carrying the owner's authority.
    {
      const other = world.build({ title: 'owner and a peer', peers: ['bella'] });
      const oPhone = auth.generateIdentity('o-phone');
      world.ask(other.box, other.owner, { setDevice: { key: oPhone.publicKey } });
      function sendAs(signer, to, text) {
        return other.box.send(
          'andy', to, text,
          auth.sign(signer.privateKey, auth.sendMessage('andy', to, text))
        );
      }

      const atPeer = sendAs(oPhone, 'bella', 'hello bella');
      if (atPeer.ok === false && atPeer.status === 403) {
        test.check('a handheld cannot reach another peer at all — not refused late, refused here');
      } else {
        test.fail('device reached a peer: ' + JSON.stringify(atPeer));
      }

      // AND THE HOUSE KEY STILL CAN, so this is not a check that simply
      // broke sending to peers.
      const houseAtPeer = sendAs(other.owner, 'bella', 'hello bella');
      if (houseAtPeer.ok) {
        test.check('while the identity itself still reaches its peers as before');
      } else {
        test.fail('the house key was confined too: ' + JSON.stringify(houseAtPeer));
      }

      // ITS OWN IDENTITY WAS THE ONE CORRESPONDENT IT HAD — a note to
      // yourself from your own phone — and now it has none, on this wire.
      //
      // That is not a loss of function: it is the confinement completed.
      // A device's correspondent is the NODE that owns it, and a node is
      // not reachable by signing as it on a relay. Whatever a device ends
      // up able to do, it will do through its node (DEVICE.md §7), and
      // the relay will carry it the way deviceOffer already does.
      const atSelf = sendAs(oPhone, 'andy', 'note to self');
      if (atSelf.ok === false) {
        test.check('and not even its own identity — a device key proves nothing to a relay at all');
      } else {
        test.fail('a device still reached a relay: ' + JSON.stringify(atSelf));
      }

      // AND THE CARVE-OUT IS GONE, which makes this rule one clause
      // shorter than it was.
      //
      // `relay` was the one destination a device could reach besides
      // itself, kept because it was the device page's only working
      // function. The comment in relay.js said what to do about it —
      // "when the device channel exists it should go, because a
      // device's correspondent is its NODE and not a relay" — and
      // deleting the console (2026-09-13) settled it early.
      //
      // So the confinement now reads as it always should have: to
      // itself, and nowhere else.
      const atRelay = sendAs(oPhone, 'relay', 'whoami');
      if (!atRelay.ok) {
        test.check('and not the relay either — the last exception to its confinement is gone');
      } else {
        test.fail('a device still reached the reserved name: ' + JSON.stringify(atRelay));
      }
    }

    // LOST: the owner-only report. The house key still opens it, so this
    // is not a check that simply broke `status`.
    const houseReport = D.box.status('andy', auth.sign(D.owner.privateKey, auth.statusMessage('andy')));
    const deviceReport = D.box.status('andy', auth.sign(handheld.privateKey, auth.statusMessage('andy')));
    if (houseReport.ok && deviceReport.ok === false) {
      test.check('but the owner-only report takes the house key alone');
    } else {
      test.fail('status: house=' + houseReport.ok + ' device=' + deviceReport.ok);
    }

    // LOST WITH THE CONSOLE: its owner words. Two checks stood here —
    // that a handheld asking `invites` was refused the live token list,
    // and that `whoami` told the house key and the device apart despite
    // both signing as the same label.
    //
    // They are gone because the console is, and the thing they guarded
    // moved rather than vanished: live invites now travel in the
    // relay's own status report, which goes to the OWNER'S SINK and to
    // no other. A device holds no stream at all (streamOpen refuses a
    // device key outright), so it cannot be a recipient of one — which
    // is a stronger answer than a console refusing it a word.
    //
    // spirit/test/relayStatus.js is where that is now proven, including
    // the negative half. Asserted here too, at the one thing THIS suite
    // is about: a device cannot open the wire its owner is on.
    const deviceStream = D.box.streamOpen(
      'andy',
      auth.sign(handheld.privateKey, auth.streamMessage(handheld.publicKey)),
      { write: function () { return true; }, close: function () {} }
    );
    if (!deviceStream.ok) {
      test.check('and a handheld cannot open the stream its owner is on, so it can receive no report either');
    } else {
      test.fail('a device opened a stream: ' + JSON.stringify(deviceStream));
    }

    // A DEVICE CANNOT MINT, and never could. What changed on 2026-09-13
    // is WHERE that is true, which is exactly the kind of thing a
    // collapse can lose quietly.
    //
    // It used to be refused by the mint signature, which verified against
    // allow.byName rather than keysForName. That whole signed format is
    // gone (decision 0010) and minting is a post to the relay now — so
    // this asks the question again on the new path instead of assuming
    // the answer travelled with it.
    //
    // It holds, on a different mechanism: postSignatureFor verifies
    // against the ROW key alone and never consults keysForName, so a
    // handheld signing as `andy` cannot make the bytes. The router path
    // never admitted a device key in the first place.
    const relayKey = D.box.mailboxPublicKey();
    const wanted = JSON.stringify({
      app: 'relay', v: 1, body: { invite: { label: 'stranger', days: 7, token: '' } },
    });
    const minted = D.box.routePost('andy', relayKey, wanted,
      auth.sign(handheld.privateKey, auth.postMessage('andy', relayKey, wanted)));

    // THE SECOND HALF IS WHAT MAKES THE FIRST MEAN ANYTHING: it proves
    // the refusal came from who signed, and not from a relay that refuses
    // every mint for some unrelated reason.
    const byTheHouse = D.box.mint('andy', 'stranger', 7, '');
    if (minted.ok === false && byTheHouse.ok === true) {
      test.check('and cannot mint an invite: a device key does not sign a post, which is the only way to ask');
    } else {
      test.fail('handheld: ' + JSON.stringify(minted) + ' house: ' + JSON.stringify(byTheHouse));
    }
  }

  test.subHeading('The owner is an identity like any other');

  const ownerPhone = auth.generateIdentity('owner-phone');

  // No implicit owner any more. The bare /device page resolved an
  // omitted token to whoever owned the box; B3 gave every page a key in
  // its address and the page was retired, so this is the last way to
  // enrol without naming anybody — and it refuses.
  const nameless = await L.box.deviceOffer('', 'pw-owner', ownerPhone.publicKey);
  if (nameless && nameless.ok === false) {
    test.check('an offer that names nobody reaches nobody');
  } else {
    test.fail('nameless offer: ' + JSON.stringify(nameless));
  }

  const ownerStream = streaming(L.box, L.owner);
  const ownerOffer = L.box.deviceOffer('andy', 'pw-owner', ownerPhone.publicKey);
  const ownerGot = offerOn(ownerStream);
  if (ownerGot && ownerGot.carried && ownerGot.carried.password === 'pw-owner') {
    test.check('and the owner, named, is offered to like everybody else');
  } else {
    test.fail('owner got: ' + JSON.stringify(ownerGot && ownerGot.carried));
  }
  // AND NOBODY'S DEVICE IS WRITTEN INTO allow.json, which is a stronger
  // statement than the one that stood here.
  //
  // It used to check that the OWNER's device landed in allow.json and a
  // PEER's did not — the two rooms rule, with the owner's device in the
  // owner's room. A relay keeps no device key at all now, so the rule it
  // was protecting has nothing left to protect: no room holds one.
  const allowRaw = fs.readFileSync(path.join(L.home, 'relay-state', 'allow.json'), 'utf8');
  if (allowRaw.indexOf(ownerPhone.publicKey) === -1 &&
      allowRaw.indexOf(phoneA.publicKey) === -1 &&
      allowRaw.indexOf('devicePublicKey') === -1) {
    test.check("and allow.json holds no device key at all — not the owner's, not a peer's");
  } else {
    test.fail('allow.json holds a device key: ' + allowRaw);
  }

  replyTo(L.box, L.owner, ownerGot.req, false, '');
  await ownerOffer;

  test.subHeading('A key survives being a URL segment');

  // The reason this exists: keys are STANDARD base64, and that alphabet
  // contains `/`. A `/` in a path segment is not in the segment — it
  // splits it — so `/<raw key>/device` would be two segments for roughly
  // one key in sixteen. Built, not assumed: a key is searched for until
  // one turns up with a slash in it.
  let slashed = null;
  for (let n = 0; n < 200 && !slashed; n += 1) {
    const k = auth.generateIdentity('probe').publicKey;
    if (k.indexOf('/') !== -1) slashed = k;
  }
  if (slashed) {
    const seg = deviceAuth.keyToUrl(slashed);
    if (seg.indexOf('/') === -1 && deviceAuth.keyFromUrl(seg) === slashed) {
      test.check('a key containing a slash survives the round trip, and carries none');
    } else {
      test.fail('slashed key: ' + slashed + ' -> ' + seg + ' -> ' + deviceAuth.keyFromUrl(seg));
    }
  } else {
    test.check('(no slash-bearing key in 200 tries — the encoding is still what protects it)');
  }

  // Canonical: one key, one segment, and nothing else decodes to it.
  const segA = deviceAuth.keyToUrl(johnA.publicKey);
  if (deviceAuth.keyFromUrl(segA) === johnA.publicKey && deviceAuth.keyToUrl(
    deviceAuth.keyFromUrl(segA)
  ) === segA) {
    test.check('and the segment is canonical — one key, one address');
  } else {
    test.fail('not canonical: ' + segA);
  }

  // A segment that is not base64url at all is not a near-miss to be
  // guessed at. It is nothing.
  if (deviceAuth.keyFromUrl('../../etc/passwd') === '' && deviceAuth.keyFromUrl('') === '') {
    test.check('and anything that is not a key decodes to nothing');
  } else {
    test.fail('keyFromUrl accepted a non-key');
  }

  test.subHeading('The relay will say whether an identity exists, and no more');

  const pub = L.box.deviceIdentityPublic(johnA.publicKey);
  if (pub && pub.label === 'john' && pub.owner === false) {
    test.check('a peer key resolves to a label the router can use');
  } else {
    test.fail('public identity: ' + JSON.stringify(pub));
  }
  // What it must NOT hand back. Everything here is public already, but a
  // routing helper that returns keys is one refactor away from being the
  // thing that hands out a device key.
  if (pub && !pub.publicKey && !pub.devicePublicKey && !pub.peer) {
    test.check('and carries no key of any kind back to the router');
  } else {
    test.fail('public identity leaked a key: ' + JSON.stringify(pub));
  }
  if (L.box.deviceIdentityPublic('MCowBQYDK2VwAyEAnobodyhasthiskeyatallxxxxxxxxxxxxxxxxxxxxxx=') === null) {
    test.check('and a key nobody holds is nobody — which is the 404');
  } else {
    test.fail('a stranger key resolved');
  }

  test.subHeading('A peer knows which relays it holds a row on');

  // The badge answers "do I OWN this" with a signed status. A peer owns
  // nothing, so before B2 its device timer got an empty list and never
  // polled — the feature stopped at the owner for want of one word.
  // `claimed` is the other question, asked of the PUBLIC census.
  const ownerBadge = require('../run/js/ownerBadge');
  const nodeHome = world.tmpHome();
  fs.mkdirSync(path.join(nodeHome, 'app', 'natter'), { recursive: true });
  fs.writeFileSync(
    path.join(nodeHome, 'app', 'natter', 'relays.json'),
    JSON.stringify([{ label: 'lab', url: 'http://relay' }])
  );
  auth.saveIdentity(nodeHome, johnA);

  function labRequest(url, method, pathname) {
    if (/\/api\/relay\/status/.test(pathname)) {
      return Promise.resolve({ status: 403, text: JSON.stringify({ error: 'not owner' }) });
    }
    if (/\/api\/relay\/who/.test(pathname)) {
      // The WIRE shape, which wraps the list — relay.who() is an array
      // in process and `{ peers: [...] }` over HTTP (server.js). A fake
      // that answers the in-process shape tests nothing the node will
      // ever receive.
      return Promise.resolve({
        status: 200,
        text: JSON.stringify({ peers: L.box.who() }),
      });
    }
    return Promise.resolve({ status: 404, text: '{}' });
  }

  const mine = await ownerBadge.probe(nodeHome, 'john', labRequest, johnA.publicKey);
  if (mine && mine.ownedUrls.length === 0 && mine.claimedUrls.length === 1) {
    test.check('a peer owns nothing and still holds a row — 0 owned, 1 claimed');
  } else {
    test.fail('probe: owned=' + JSON.stringify(mine && mine.ownedUrls) +
      ' claimed=' + JSON.stringify(mine && mine.claimedUrls));
  }

  const stranger = auth.generateIdentity('nobody');
  const none = await ownerBadge.probe(nodeHome, 'nobody', labRequest, stranger.publicKey);
  if (none && none.claimedUrls.length === 0) {
    test.check('and a key with no row anywhere claims nothing');
  } else {
    test.fail('stranger claimed: ' + JSON.stringify(none && none.claimedUrls));
  }

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
