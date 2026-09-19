'use strict';
const rollOf = require('./rollOf');

// spirit/test/partnerGate.js
// TWO RELAYS, ONE PROCESS, NO SOCKETS — and the one hop, enforced.
//
//   Andy: "search must be member gated. on propagated search is partner
//   gated."
//
// Two gates and two authorities. A member asks its own relay because it is
// enrolled there; a relay asks a partner because the partner pinned its key
// at promotion. Neither can be reached by the other's route, and this file
// is where that stops being a sentence in PARTNERS.md.
//
// WHY IT CAN BE DRIVEN WITH NOTHING RUNNING. `createRelay` is a function
// over a directory, and `routePost`/`streamOpen` are ordinary calls on what
// it answers. So relay A and relay B are two objects in one process, and
// what crosses between them is what would cross a wire — a signed post and
// a reply on a held stream — with no TLS, no Caddy and no port.
//
//   Andy: "these are things that will be proven mainly without screen, so
//   we must be extra precise in testing our partner-network theory."

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { createRelay } = require('../run/js/relay');

// Collects what a held stream was sent, the way sseClient would parse it.
function sinkFor(bag) {
  return {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (!ev) return;
      let parsed = null;
      try { parsed = da ? JSON.parse(da[1]) : null; } catch (e) { parsed = null; }
      bag.push({ event: ev[1], data: parsed });
    },
    close: function () {},
  };
}

// One relay, with an owner and however many members.
function relayWith(tag, memberNames) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-partner-' + tag + '-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));

  const owner = auth.generateIdentity('owner-' + tag);
  auth.writeAllowKeys(home, [{ name: 'owner' + tag, publicKey: owner.publicKey }]);

  const box = createRelay(home);
  box.claim('owner' + tag, auth.sign(owner.privateKey, auth.claimMessage('owner' + tag)), owner.publicKey);

  // The real way on, as relayStatus and relayMonitor do it: a fixture that
  // writes a row directly proves a rule against a relay nobody could join.
  const members = {};
  (memberNames || []).forEach(function (name) {
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner' + tag, name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, null, minted.invite.token, name);
    members[name] = id;
  });

  return { home: home, box: box, owner: owner, members: members, key: box.relayPublicKey() };
}

// A signed post, exactly as one arrives off the wire.
function post(box, from, toKey, bodyObj) {
  const text = JSON.stringify({ v: 1, body: bodyObj });
  return box.routePost(from.publicKey, toKey, text,
    auth.sign(from.privateKey, auth.postMessage(from.publicKey, toKey, text)));
}

// The same, signed by a RELAY as itself rather than by a person.
function postAsRelay(box, fromKey, fromPrivate, toKey, bodyObj) {
  const text = JSON.stringify({ v: 1, body: bodyObj });
  return box.routePost(fromKey, toKey, text,
    auth.sign(fromPrivate, auth.postMessage(fromKey, toKey, text)));
}

function lastReply(bag) {
  const replies = bag.filter(function (m) { return m.event === 'reply'; });
  if (!replies.length) return null;
  let parsed = null;
  try { parsed = JSON.parse(replies[replies.length - 1].data.text); }
  catch (e) { return null; }
  return (parsed && parsed.body) || null;
}

test.startTest('The partner gate — two relays, one hop, nothing running');

// ---------------------------------------------------------------------
// A and B, partnered by their owners, each pinning the other's relay key.
const A = relayWith('a', ['alice']);
const B = relayWith('b', ['bella', 'bertrand']);

const aIdentity = auth.loadIdentity(A.home);
const bIdentity = auth.loadIdentity(B.home);

// RECIPROCITY IS A MEMBERSHIP, and it is checked at promotion time: a
// partnership rides the row of the relay owner who is a peer HERE, so each
// owner joins the other relay before either can promote the other. That is
// PARTNERS.md's "if you can verify a peer, and we can verify each other" —
// the middle clause, made of an enrolment rather than an assertion.
function enrol(relay, tag, identity, name) {
  const minted = relay.box.mint('owner' + tag, name, 7, '');
  return relay.box.claim(name,
    auth.sign(identity.privateKey, auth.claimMessage(name)),
    identity.publicKey, null, minted.invite.token, name);
}
enrol(B, 'b', A.owner, 'ownera');
enrol(A, 'a', B.owner, 'ownerb');

const promotedA = A.box.setPartner(A.owner, B.owner.publicKey, 'http://b.example', B.key, 'h1');
const promotedB = B.box.setPartner(B.owner, A.owner.publicKey, 'http://a.example', A.key, 'h2');
if (!promotedA.ok || !promotedB.ok) {
  test.fail('the fixture did not partner them: ' +
    JSON.stringify(promotedA) + ' / ' + JSON.stringify(promotedB));
}

test.subHeading('A partner is admitted, and is not a member');

{
  // It has no row, no label, and never appears in a census — the partner
  // is recognised only by the key it signs with.
  const census = rollOf(B.box);
  const asRow = (census.peers || census || []).filter(function (p) {
    return p && p.publicKey === A.key;
  });
  if (asRow.length === 0) {
    test.check('the partner relay has no row on B and is in no census');
  } else {
    test.fail('partner appeared as a member: ' + JSON.stringify(asRow));
  }

  // But it may hold a stream, because a reply leaves by one.
  const heardByA = [];
  const opened = B.box.streamOpen(A.key,
    auth.sign(aIdentity.privateKey, auth.streamMessage(A.key)), sinkFor(heardByA));
  if (opened && opened.ok !== false) {
    test.check('and may still hold a stream on B — request by post, reply by stream');
  } else {
    test.fail('partner refused a stream: ' + JSON.stringify(opened));
  }
  A.heard = heardByA;
}

// ---------------------------------------------------------------------
test.subHeading('A stranger relay is refused');

{
  const stranger = auth.generateIdentity('relay');
  const sent = postAsRelay(B.box, stranger.publicKey, stranger.privateKey, B.key,
    { search: { q: 'bel' } });
  if (!sent.ok && sent.status === 403) {
    test.check('an unpinned key is nobody: ' + sent.error);
  } else {
    test.fail('stranger admitted: ' + JSON.stringify(sent));
  }

  const heard = [];
  const stream = B.box.streamOpen(stranger.publicKey,
    auth.sign(stranger.privateKey, auth.streamMessage(stranger.publicKey)), sinkFor(heard));
  if (!stream.ok) {
    test.check('and cannot hold a stream either — the pinned key is the whole proof');
  } else {
    test.fail('stranger got a stream');
  }
}

// ---------------------------------------------------------------------
test.subHeading('A partner may search, and gets B members');

{
  // ONLINE ONLY (Andy, 2026-09-19: "search should respond with
  // active/online members only"). Asked before anybody on B is connected,
  // the answer is nobody; the same question once they are, names them.
  postAsRelay(B.box, A.key, aIdentity.privateKey, B.key, { search: { q: 'be' } });
  const before = lastReply(A.heard);
  if (before && before.ok && (before.matches || []).length === 0) {
    test.check('nobody offline is found — bella and bertrand are not connected yet');
  } else {
    test.fail('offline found: ' + JSON.stringify(before));
  }
  ['bella', 'bertrand'].forEach(function (name) {
    const id = B.members[name];
    B.box.streamOpen(id.publicKey, auth.sign(id.privateKey, auth.streamMessage(id.publicKey)), sinkFor([]));
  });

  const sent = postAsRelay(B.box, A.key, aIdentity.privateKey, B.key,
    { search: { q: 'be' } });
  if (sent.ok) {
    test.check('the post is admitted and routed to B itself');
  } else {
    test.fail('refused: ' + JSON.stringify(sent));
  }

  const answer = lastReply(A.heard);
  const labels = ((answer && answer.matches) || []).map(function (m) { return m.publicLabel; });
  if (answer && answer.ok && labels.indexOf('bella') !== -1 && labels.indexOf('bertrand') !== -1) {
    test.check('and the answer names B own members: ' + labels.join(', '));
  } else {
    test.fail('answer: ' + JSON.stringify(answer));
  }
}

// ---------------------------------------------------------------------
test.subHeading('And may ask for nothing else');

{
  const before = A.heard.length;
  postAsRelay(B.box, A.key, aIdentity.privateKey, B.key, { partners: true });
  const answer = lastReply(A.heard);

  // `{partners:true}` is a verb ANY MEMBER may ask. A partner is not a
  // member, and gets the same `no such peer` a stranger would — so the
  // set of things this box will do for a partner is not enumerable by
  // asking.
  if (A.heard.length > before && answer && answer.ok !== true) {
    test.check('a verb every member may ask is refused to a partner: ' + answer.error);
  } else {
    test.fail('partner got partners: ' + JSON.stringify(answer));
  }

  postAsRelay(B.box, A.key, aIdentity.privateKey, B.key, { monitor: { on: true } });
  const mon = lastReply(A.heard);
  if (mon && mon.ok !== true) {
    test.check('and so is an owner verb, with the same words: ' + mon.error);
  } else {
    test.fail('partner got monitor: ' + JSON.stringify(mon));
  }
}

// ---------------------------------------------------------------------
test.subHeading('A partner may not reach a member — that is the second hop');

{
  const bella = B.members.bella;
  const sent = postAsRelay(B.box, A.key, aIdentity.privateKey, bella.publicKey,
    { hello: true });

  // One hop means a partner talks to the RELAY and the relay talks to its
  // own. A partner addressing a member directly is the second hop arriving
  // by the side door, and it is refused in the words a stranger gets.
  if (!sent.ok && sent.status === 403) {
    test.check('a partner addressing a member of B is refused: ' + sent.error);
  } else {
    test.fail('partner reached a member: ' + JSON.stringify(sent));
  }
}

// ---------------------------------------------------------------------
test.subHeading('A member is unaffected, and still gets its own relay');

{
  const heardByBella = [];
  B.box.streamOpen(B.members.bella.publicKey,
    auth.sign(B.members.bella.privateKey, auth.streamMessage(B.members.bella.publicKey)),
    sinkFor(heardByBella));

  post(B.box, B.members.bella, B.key, { search: { q: 'ber' } });
  const answer = lastReply(heardByBella);
  const labels = ((answer && answer.matches) || []).map(function (m) { return m.publicLabel; });
  if (answer && answer.ok && labels.indexOf('bertrand') !== -1) {
    test.check('a member still searches its own relay: ' + labels.join(', '));
  } else {
    test.fail('member search broke: ' + JSON.stringify(answer));
  }

  // And a member may still ask the verbs a member may ask.
  post(B.box, B.members.bella, B.key, { partners: true });
  const mine = lastReply(heardByBella);
  if (mine && mine.ok === true && Array.isArray(mine.partners)) {
    test.check('and may still ask who B partners with, which a partner may not');
  } else {
    test.fail('member lost partners: ' + JSON.stringify(mine));
  }
}

test.reportSuccessFailureCount();
