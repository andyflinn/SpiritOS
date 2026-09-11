'use strict';

// spirit/test/routerPost.js
// A peer drops a packet on a peer and gets a receipt.
//
// The payload is a PING, deliberately. Ping and ack is the router with
// the body removed — the whole mechanism exercised end to end with no
// schema, no reply semantics and no app — which is the same move that
// made presence cheap to get right: prove the machinery where being
// wrong costs nothing.
//
// It is also a capability presence cannot give. Presence says the socket
// is open; a ping says the node processed something and signed for it. A
// node whose event loop is wedged shows green and answers nothing.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const { createRelay } = require('../run/js/relay');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-router-'));
}

function fakeSink() {
  const sink = { lines: [], closed: false };
  sink.write = function (chunk) { sink.lines.push(chunk); };
  sink.close = function () { sink.closed = true; };
  sink.events = function () {
    return sink.lines.map(function (chunk) {
      const ev = /event: (.*)/.exec(chunk);
      const data = /data: (.*)/.exec(chunk);
      let parsed = null;
      try { parsed = data ? JSON.parse(data[1]) : null; } catch (e) { parsed = null; }
      return { event: ev ? ev[1] : '', data: parsed };
    });
  };
  sink.last = function (name) {
    const hits = sink.events().filter(function (e) { return e.event === name; });
    return hits.length ? hits[hits.length - 1].data : null;
  };
  return sink;
}

function lab() {
  const home = tmpHome();
  const box = createRelay(home);
  const house = auth.generateIdentity('andy');
  auth.saveIdentity(home, house);
  box.claim('andy', auth.sign(house.privateKey, auth.claimMessage('andy')), house.publicKey);
  function joinAs(label) {
    const who = auth.generateIdentity(label);
    const minted = box.mint('andy', label, 7,
      auth.sign(house.privateKey, invites.mintMessage(label, 7)));
    box.claim(label, auth.sign(who.privateKey, auth.claimMessage(label)),
      who.publicKey, '10.0.0.1', minted.invite.token);
    return who;
  }
  return { home: home, box: box, house: house, joinAs: joinAs };
}

function openStream(box, id, sink) {
  return box.streamOpen(
    id.publicKey,
    auth.sign(id.privateKey, auth.streamMessage(id.publicKey)),
    sink
  );
}

// What a requester does: build the message, sign it, and keep the hash
// it computed itself — never one it was handed.
function ping(box, from, to, text) {
  const msg = auth.postMessage(from.publicKey, to.publicKey, text);
  const sig = auth.sign(from.privateKey, msg);
  return {
    hash: auth.requestHash(msg),
    result: box.routePost(from.publicKey, to.publicKey, text, sig),
  };
}

test.startTest('Router — a ping and an ack between peers');

function run() {
  let L;
  try { L = lab(); }
  catch (e) { test.fail('lab: ' + (e && e.message)); test.reportSuccessFailureCount(); return; }

  const bert = L.joinAs('bert');
  const john = L.joinAs('john');
  const bertSink = fakeSink();
  const johnSink = fakeSink();
  openStream(L.box, bert, bertSink);
  openStream(L.box, john, johnSink);

  test.subHeading('The request reaches the target, and carries no hash');

  const sent = ping(L.box, bert, john, '{"ping":1}');
  if (sent.result.ok && sent.result.hash === sent.hash) {
    test.check('the relay accepts it and names the same hash the sender computed');
  } else {
    test.fail('post: ' + JSON.stringify(sent.result));
  }

  const arrived = johnSink.last('request');
  if (arrived && arrived.text === '{"ping":1}' && arrived.from === bert.publicKey) {
    test.check('and it arrives on the target stream, from a key rather than a label');
  } else {
    test.fail('arrived: ' + JSON.stringify(arrived));
  }

  // THE proof, and the reason the hash is not sent. The target derives
  // it from bytes it actually holds; had the relay supplied it, an echo
  // would prove nothing at all.
  if (arrived && arrived.hash === undefined) {
    test.check('the hash is NOT sent — the target must derive it or it proves nothing');
  } else {
    test.fail('a hash rode along: ' + JSON.stringify(arrived));
  }

  // And the target arrives at the same one, without the minute ever
  // having been transmitted: it recovers the message that verified.
  const seen = auth.postSignatureFor(
    arrived.from, arrived.from, arrived.to, arrived.text, arrived.sig
  );
  if (seen && auth.requestHash(seen) === sent.hash) {
    test.check('and derives the identical hash, with no minute on the wire');
  } else {
    test.fail('target hash: ' + (seen ? auth.requestHash(seen) : 'signature failed'));
  }

  test.subHeading('Only the target may answer, and only once');

  const impostorSig = auth.sign(L.house.privateKey, auth.receiptMessage(sent.hash));
  const impostor = L.box.routeReply(L.house.publicKey, sent.hash, '', impostorSig);
  if (impostor.ok === false && impostor.status === 403) {
    test.check('a member who was not asked cannot answer');
  } else {
    test.fail('impostor: ' + JSON.stringify(impostor));
  }

  const acked = L.box.routeReply(
    john.publicKey, sent.hash, '{"pong":1}',
    auth.sign(john.privateKey, auth.receiptMessage(sent.hash))
  );
  if (acked.ok && acked.delivered) {
    test.check('the target acks, and the relay says the answer landed');
  } else {
    test.fail('ack: ' + JSON.stringify(acked));
  }

  const back = bertSink.last('reply');
  if (back && back.hash === sent.hash && back.from === john.publicKey) {
    test.check('and the requester gets it back under the hash it is waiting on');
  } else {
    test.fail('reply: ' + JSON.stringify(back));
  }

  // What makes it worth having: the requester can prove WHO answered,
  // without trusting the relay that carried it.
  if (back && auth.receiptSignatureOk(john.publicKey, back.hash, back.sig)) {
    test.check('signed by the target, so the relay could not have manufactured it');
  } else {
    test.fail('receipt did not verify');
  }

  const twice = L.box.routeReply(
    john.publicKey, sent.hash, '',
    auth.sign(john.privateKey, auth.receiptMessage(sent.hash))
  );
  if (twice.ok === false && twice.status === 404) {
    test.check('and the same request cannot be answered a second time');
  } else {
    test.fail('answered twice: ' + JSON.stringify(twice));
  }

  test.subHeading('A relay that tampers is caught');

  // The whole point of hashing exactly what was signed. Nothing needs to
  // detect the tampering — the arithmetic simply stops agreeing.
  const tampered = auth.postSignatureFor(
    arrived.from, arrived.from, arrived.to, arrived.text + ' ', arrived.sig
  );
  if (!tampered) {
    test.check('a single byte changed in flight and the signature no longer verifies');
  } else {
    test.fail('tampered text still verified');
  }

  test.subHeading('Refused instantly rather than held');

  const absent = L.joinAs('ghost');
  const nowhere = ping(L.box, bert, absent, '{"ping":1}');
  if (nowhere.result.ok === false && nowhere.result.status === 503) {
    test.check('a peer who is not connected is an immediate error, not a wait');
  } else {
    test.fail('absent: ' + JSON.stringify(nowhere.result));
  }

  const stranger = auth.generateIdentity('nobody');
  const unknown = ping(L.box, bert, stranger, '{"ping":1}');
  if (unknown.result.ok === false && unknown.result.status === 404) {
    test.check('and a key with no row here is not a peer at all');
  } else {
    test.fail('stranger: ' + JSON.stringify(unknown.result));
  }

  const forged = L.box.routePost(
    bert.publicKey, john.publicKey, '{"ping":1}',
    auth.sign(john.privateKey, auth.postMessage(bert.publicKey, john.publicKey, '{"ping":1}'))
  );
  if (forged.ok === false && forged.status === 403) {
    test.check('and one peer cannot post in the name of another');
  } else {
    test.fail('forged: ' + JSON.stringify(forged));
  }

  test.subHeading('The same request twice is one request');

  // Not hygiene — the safety property. A receipt is signed over the hash
  // and nothing else, so two live requests sharing one would make a
  // single receipt valid for both (ROUTER.md §4).
  const first = ping(L.box, bert, john, '{"ping":"dup"}');
  const before = johnSink.events().length;
  const second = ping(L.box, bert, john, '{"ping":"dup"}');
  if (second.result.ok === false && second.result.inFlight === true) {
    test.check('a duplicate is told "already in flight" rather than simply refused');
  } else {
    test.fail('duplicate: ' + JSON.stringify(second.result));
  }
  if (johnSink.events().length === before) {
    test.check('and it never reaches the target, so no work is done twice');
  } else {
    test.fail('the duplicate was forwarded anyway');
  }
  void first;

  test.subHeading('Nothing is stored');

  // The relay is a router. What it held during the round trip is gone,
  // and none of it was ever the message.
  const disk = fs.readFileSync(path.join(L.home, 'relay-state', 'mailbox.json'), 'utf8');
  if (disk.indexOf('"ping"') === -1 && disk.indexOf('pong') === -1) {
    test.check('no routed body reached the disk');
  } else {
    test.fail('a routed body was persisted');
  }
  if (L.box.routes.size() === 1) {
    test.check('and the only entry still open is the one nobody answered');
  } else {
    test.fail('pending entries: ' + L.box.routes.size());
  }

  test.reportSuccessFailureCount();
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
