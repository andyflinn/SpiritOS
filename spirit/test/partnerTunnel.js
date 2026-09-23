'use strict';

// spirit/test/partnerTunnel.js
// A PACKET CROSSES A PARTNERSHIP, AND THE FAR NODE ANSWERS IT.
//
//   Andy: "in the exact same way that the node wraps the untouched
//   request from its client, and the receiving node unwraps and replies
//   to it — that's the exact same way A wraps the whole kaboodle posted
//   by the requesting node, with its own sig, and posts that to B, who
//   unwraps the outer wrapper and forwards it to N2. A tunnels N1's
//   request to B through an outer layer of the protocol."
//
// ── WHAT THIS EXISTS TO PROVE ────────────────────────────────────────
//
// Two people on relays that partner could FIND each other and ADD each
// other — both proven live on 2026-09-17 — and could not exchange a
// single packet. `describe` was the case that made it visible: a search
// result arrives, the browser asks the peer to describe itself, and the
// request died inside the asker's own node because no relay it held
// listed the target.
//
// So this drives the whole path in one process: N1 posts, A wraps, B
// unwraps, N2's node answers above its front door, and the answer comes
// back up the tunnel to N1. Every signature is real and every hash is
// derived from bytes.
//
// ── AND WHY THERE IS NO CERTIFICATE ANYWHERE IN IT ───────────────────
//
//   Andy: "the tunnel is the cheap implementation of the cheap cert."
//
// The requirement was that B can tell a trusted partner is vouching for a
// key it has never seen, without holding that partner's member list. Two
// signatures already on the wire do it: the INNER proves N1 authored the
// packet and that A cannot have forged it, the OUTER proves a partner B
// pinned at promotion is carrying it. A self-signed membership claim
// would add nothing — only the partner's agreement makes such a claim
// true, and the outer signature is that agreement.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const { sealFor, openBody } = require('./openReply');
const nodeCard = require('../run/js/nodeCard');
const auth = require('../run/js/relayAuth');
const { createRelay } = require('../run/js/relay');

// ── THE SMALLEST HONEST WORLD ────────────────────────────────────────
//
// Two relays in one process, wired to each other by the same injected
// `askPartner` the server supplies — so the hop between them is a real
// signed post through the same door, not a function call dressed up as
// one. Nothing here reaches around the protocol.

function sinkFor(bag) {
  return {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (!ev) return true;
      let parsed = null;
      try { parsed = da ? JSON.parse(da[1]) : null; } catch (e) { parsed = null; }
      bag.push({ event: ev[1], data: parsed });
      return true;
    },
    close: function () {},
  };
}

const boxes = {};          // relay public key -> the relay object
// ── THE WIRE BETWEEN TWO RELAYS: THE ANSWER IS THE REPLY TO THE POST ──
//
// R13 (cycle 8). This fixture used to model a partner's answer arriving on
// a stream A held to B — a waiter table, a buffer for replies that beat
// their waiter, and a sink per stream — because that was the product's
// path: `partnerLink.onEvent -> router.onReply`. Grok's review: "A held
// stream is a second bus." Andy agreed, and the product now keeps the
// partner's post open until B answers it (relay.js, holdForPartner).
//
// So the fixture does exactly that: routePost from a partner hands back
// `held`, and its settling IS the answer. B still parks a forward until its
// own member speaks, so the wait is real — it is simply on the post.
function askPartner(fromHome) {
  return function (url, relayKey, text) {
    const me = auth.loadIdentity(fromHome);
    const target = boxes[relayKey];
    if (!target) return Promise.resolve(null);
    const sig = auth.sign(me.privateKey, auth.postMessage(me.publicKey, relayKey, text));
    const posted = target.routePost(me.publicKey, relayKey, text, sig);
    if (!posted || !posted.ok) return Promise.resolve(null);
    if (!posted.held) return Promise.resolve(null);
    return posted.held.then(function (answer) {
      return answer && answer.ok ? { text: answer.text, status: 200 } : answer;
    });
  };
}

function relayWith(tag, memberNames) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-tunnel-' + tag + '-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay-' + tag));

  const owner = auth.generateIdentity('owner-' + tag);
  auth.writeAllowKeys(home, [{ name: 'owner' + tag, publicKey: owner.publicKey }]);

  const box = createRelay(home, { askPartner: askPartner(home) });
  box.claim('owner' + tag, auth.sign(owner.privateKey, auth.claimMessage('owner' + tag)), owner.publicKey,
    null, null, null, nodeCard.cardFrom(Object.assign({ name: 'owner' + tag }, owner)));

  const people = {};
  const inboxes = {};
  (memberNames || []).forEach(function (name) {
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner' + tag, name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, null, minted.invite.token, name,
      nodeCard.cardFrom(Object.assign({ name: name }, id)));
    people[name] = id;
    inboxes[name] = [];
    box.streamOpen(id.publicKey,
      auth.sign(id.privateKey, auth.streamMessage(id.publicKey)), sinkFor(inboxes[name]));
  });

  boxes[box.relayPublicKey()] = box;
  return { home, box, owner, people, inboxes, key: box.relayPublicKey() };
}

// `atRelayKey` is the fifth argument: a trusted partner key, the in-process
// hook this suite drives forwarding through. From the wire the same slot
// carries signed route hints instead (cycle 2) — see routeHints.js and
// hintWire.js — which the relay verifies before choosing ONE partner.
//
// The first version needed no such argument because it BROADCAST to every
// partner, which disclosed a member's packet to relays that had no
// business seeing it and burned a pool unit at each of them. Passing the
// target explicitly is what makes that impossible rather than discouraged.
// Sealed when it is addressed to the relay (cycle 10, R9); a peer-to-peer
// packet is routed rather than read, so it travels as it always did.
function post(box, from, toKey, bodyObj, atRelayKey) {
  const plain = JSON.stringify({ v: 1, body: bodyObj });
  const text = toKey === box.relayPublicKey() ? sealFor(from, box, plain) : plain;
  return box.routePost(from.publicKey, toKey, text,
    auth.sign(from.privateKey, auth.postMessage(from.publicKey, toKey, text)), atRelayKey);
}

test.startTest('A packet crosses a partnership, and the far node answers it');

// ---------------------------------------------------------------------
// A holds jazz. B holds sonny. They are partners and share nobody.

const A = relayWith('a', ['jazz']);
const B = relayWith('b', ['sonny']);

// Reciprocity is a membership: each owner joins the other's relay before
// either may promote the other, which is what makes the partnership
// checkable rather than asserted.
function enrol(relay, tag, identity, name) {
  const minted = relay.box.mint('owner' + tag, name, 7, '');
  return relay.box.claim(name, auth.sign(identity.privateKey, auth.claimMessage(name)),
    identity.publicKey, null, minted.invite.token, name);
}
enrol(B, 'b', A.owner, 'ownera');
enrol(A, 'a', B.owner, 'ownerb');

// A fourth box, partnered with A, so "unnamed goes nowhere" is tested
// against a partner that COULD have been guessed at rather than against
// an empty list.
const D = relayWith('d', ['dave']);
const okA = A.box.setPartner(A.owner, B.owner.publicKey, 'http://b.example', B.key, 'h1');
const okB = B.box.setPartner(B.owner, A.owner.publicKey, 'http://a.example', A.key, 'h2');
if (!okA.ok || !okB.ok) {
  test.fail('the fixture did not partner them: ' + JSON.stringify(okA) + ' / ' + JSON.stringify(okB));
}

// ── AND NOBODY DIALS (R13) ───────────────────────────────────────────
//
// This block opened a stream each way between every pair of partners,
// AFTER promotion, because a partner's answer could only land on one.
// There is no partner stream now: a partner's answer is the reply to its
// own post, so the partnership is live the moment both sides have promoted.
enrol(D, 'd', A.owner, 'ownera');
enrol(A, 'a', D.owner, 'ownerd');
A.box.setPartner(A.owner, D.owner.publicKey, 'http://d.example', D.key, 'h5');
D.box.setPartner(D.owner, A.owner.publicKey, 'http://a.example', A.key, 'h6');

// ── 1. THE PACKET ARRIVES ────────────────────────────────────────────

test.subHeading('jazz posts to sonny, who is on nobody jazz has ever heard of');

const sent = post(A.box, A.people.jazz, B.people.sonny.publicKey, { card: true }, B.key);

if (sent && sent.ok) {
  test.check('A took it rather than answering "no such peer" — 202 with a hash');
} else {
  test.fail('A refused a post it could have carried: ' + JSON.stringify(sent));
}

const arrived = B.inboxes.sonny.filter(function (m) { return m.event === 'request'; });

if (arrived.length === 1) {
  test.check('and it arrived on sonny’s stream, delivered by B');
} else {
  test.fail(arrived.length + ' requests reached sonny');
}

// ── THE PACKET IS N1's, NOT A's ──────────────────────────────────────
//
// This is the whole of tunnelling: what sonny receives is jazz's packet,
// with jazz's key on it and jazz's signature over it. A is a carrier. If
// A had re-composed the request — the way it re-composes a SEARCH, which
// is its own question — sonny would be verifying a relay's signature and
// would have no idea who was asking.
const inner = arrived.length ? arrived[0].data : null;

if (inner && inner.from === A.people.jazz.publicKey && inner.to === B.people.sonny.publicKey) {
  test.check('carrying jazz’s own from and to — A is a carrier, not the asker');
} else {
  test.fail('the packet was rewritten: ' + JSON.stringify(inner));
}

// AND THE SIGNATURE SURVIVED, which is what lets sonny answer a stranger
// safely: the proof is jazz's, checkable by sonny, and neither relay
// could have produced it.
const verified = inner && auth.postSignatureFor(
  inner.from, inner.from, inner.to, inner.text, inner.sig);

if (verified) {
  test.check('and jazz’s signature verifies at sonny — untouched by two relays');
} else {
  test.fail('the inner signature did not survive the hop');
}

// THE HASH IS THE SAME NUMBER AT BOTH ENDS, and nobody sent it (0011).
// jazz derived it when posting; sonny derives it from the bytes that
// arrived; A and B each derived it to open their half of the route.
if (verified && auth.requestHash(verified) === sent.hash) {
  test.check('and the hash matches end to end, having crossed on nobody’s wire');
} else {
  test.fail('hash mismatch: ' + (verified && auth.requestHash(verified)) + ' vs ' + sent.hash);
}

// ── 2. THE ANSWER COMES BACK UP THE TUNNEL ───────────────────────────

test.subHeading('And sonny’s answer reaches jazz');

// ── THE ANSWER IS NOT SYNCHRONOUS, AND MUST NOT BE ───────────────────
//
// B parks the forward, its member answers whenever it answers, and the
// reply reaches A as an event on a held stream. Even in one process that
// crosses a promise, so the assertions below wait a tick. A version of
// this test that read the inbox immediately would pass only against a
// fixture that short-circuited the wire — which is the failure mode this
// suite exists to avoid.
(async function () {

  // sonny answers as a node does: a receipt signed over the hash it
  // derived itself, with the card as the text.
  const card = JSON.stringify({ v: 1, body: { ok: true, name: 'sonny', description: 'a lab node' } });
  const answered = B.box.routeReply(B.people.sonny.publicKey, sent.hash, card,
    auth.sign(B.people.sonny.privateKey, auth.receiptMessage(sent.hash)));

  if (answered && answered.ok) {
    test.check('B took sonny’s reply for a request that came from a partner');
  } else {
    test.fail('B refused the reply: ' + JSON.stringify(answered));
  }

  // One tick for B's reply to travel A's stream and be re-sent to jazz.
  await Promise.resolve();
  await Promise.resolve();

  const back = A.inboxes.jazz.filter(function (m) { return m.event === 'reply'; });

  if (back.length === 1 && back[0].data && back[0].data.hash === sent.hash) {
    test.check('and it landed on jazz’s stream, matched to the post she made');
  } else {
    test.fail('jazz got ' + back.length + ' replies: ' + JSON.stringify(back.map(function (m) { return m.data; })));
  }

  // WHAT SONNY SAID, UNALTERED. Two relays carried it and neither is able
  // to change a word without breaking the receipt.
  const said = back.length ? back[0].data : null;
  const receiptOk = said && auth.receiptSignatureOk(said.from, said.hash, said.sig);

  if (receiptOk && said.from === B.people.sonny.publicKey) {
    test.check('signed by sonny over the same hash — neither relay could have written it');
  } else {
    test.fail('the receipt does not check out: ' + JSON.stringify(said));
  }

  if (said && JSON.parse(said.text).body.description === 'a lab node') {
    test.check('and the description arrives whole: "a lab node"');
  } else {
    test.fail('the card did not survive: ' + (said && said.text));
  }

  // ── 3. ONE HOP, AND IT IS AN ABSENCE OF CODE ─────────────────────────

  test.subHeading('And a forward is never re-forwarded');

  // C partners with B. A packet from A must not reach C through B: that is
  // the second hop, and the rule is enforced by `!who.partner` on the carry
  // and by `forwardToMine` only ever delivering to its own members.
  const C = relayWith('c', ['carol']);
  enrol(C, 'c', B.owner, 'ownerb');
  enrol(B, 'b', C.owner, 'ownerc');
  B.box.setPartner(B.owner, C.owner.publicKey, 'http://c.example', C.key, 'h3');
  C.box.setPartner(C.owner, B.owner.publicKey, 'http://b.example', B.key, 'h4');

  post(A.box, A.people.jazz, C.people.carol.publicKey, { card: true }, B.key);
  await Promise.resolve();
  await Promise.resolve();
  const reachedCarol = C.inboxes.carol.filter(function (m) { return m.event === 'request'; });

  if (!reachedCarol.length) {
    test.check('carol is two hops away and hears nothing — B will not re-forward');
  } else {
    test.fail('the packet took a second hop: ' + JSON.stringify(reachedCarol[0].data));
  }

  // AND IT IS NOT A COUNTER. The refusal is structural: a partner's post is
  // never carried onward (`!who.partner`), and a forward is only ever
  // delivered to a member of the box that received it. There is no hop
  // count anybody could get wrong.
  // COMMENTS STRIPPED FIRST. This file discusses hops at length, and a
  // check its own explanation can fail is the trap oneDoor documents.
  const src = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'relay.js'), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '');
  if (/!target && !who\.partner/.test(src) && !/hopCount|hopsLeft|maxHops/.test(src)) {
    test.check('and there is no hop counter — the second hop is code that does not exist');
  } else {
    test.fail('one hop is being counted rather than structural');
  }

  // ── 4. AND NO CERTIFICATE WAS NEEDED ─────────────────────────────────

  test.subHeading('And the tunnel is the cheap implementation of the cheap cert');

  // Grok proposed a membership certificate — the member signing
  // (memberKey, relayKey, minute) — so B could tell a partner was vouching
  // for a key it had never seen, without holding that partner's roster.
  // The two signatures above do it, so no primitive was built.
  if (!/memberOfMessage|certMessage/.test(src) &&
      !/memberOfMessage/.test(fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'relayAuth.js'), 'utf8'))) {
    test.check('no certificate primitive exists — the two signatures already carried it');
  } else {
    test.fail('a certificate was built after all');
  }

  // ── 5. ONE PARTNER, AND NEVER A BROADCAST ──────────────────────────
  //
  // The first version of `carryToPartner` posted the wrapper to every
  // partner in parallel and let the wrong ones refuse it. Andy killed it
  // on three counts, and the third is the one that makes it fail rather
  // than merely offend:
  //
  //   — every uninvolved partner receives a full copy of a packet
  //     addressed to somebody else's member;
  //   — N posts for one delivery;
  //   — *"and you burn your quota on all partners in parallel"* — each
  //     post spends a unit of this relay's standing in a DIFFERENT
  //     relay's partner pool, so nineteen partners cost nineteen units
  //     per forward. That is `partners × members` coming back as traffic
  //     after 0012 deleted it as memory.
  //
  // So it goes to one named partner or nowhere. Asserted twice: that the
  // code holds no loop over partners, and that a forward with no named
  // target is refused rather than guessed at.

  test.subHeading('A forward goes to one named partner, or nowhere');

  const carry = src.slice(src.indexOf('function carryToPartner'));
  const body = carry.slice(0, carry.indexOf('\n  }'));

  if (!/forEach|\.map\(/.test(body)) {
    test.check('carryToPartner holds no loop over partners — a broadcast cannot be written here by accident');
  } else {
    test.fail('something iterates the partner list: ' + body.slice(0, 200));
  }

  // AND UNNAMED MEANS UNSENT. A post that names no partner — no key in
  // process, no hints on the wire — is never guessed at. (Since cycle 2 a
  // node names one with route hints; without them this still holds.)
  D.inboxes.dave.length = 0;
  const unnamed = post(A.box, A.people.jazz, D.people.dave.publicKey, { card: true });

  if (unnamed && !unnamed.ok && unnamed.status === 404) {
    test.check('and a post with no named partner is "no such peer", not a guess');
  } else {
    test.fail('an unnamed forward went somewhere: ' + JSON.stringify(unnamed));
  }

  if (!D.inboxes.dave.filter(function (m) { return m.event === 'request'; }).length) {
    test.check('and dave heard nothing — nothing was tried on his relay');
  } else {
    test.fail('an unnamed forward reached a partner anyway');
  }

  // ── 6. A SEARCH PAYS FOR EVERY ROUTE, SO IT RETURNS EVERY ROUTE ────
  //
  //   Andy: "if you pay the price for search, may as well get valuable,
  //   cachable routing info with it."
  //
  // The fan-out asks every partner and every answer arrives. The merger
  // used to keep the best row and drop the knowledge that other relays
  // hold the same peer — a routing table discarded at the last step, after
  // being paid for in full.
  //
  // Here dave is a member of BOTH D and B, so a search from jazz on A
  // reaches him twice and must come back naming both.

  test.subHeading('A peer found on two partners comes back with both routes');

  const daveKey = D.people.dave.publicKey;
  const mintB = B.box.mint('ownerb', 'dave', 7, '');
  B.box.claim('dave', auth.sign(D.people.dave.privateKey, auth.claimMessage('dave')),
    daveKey, null, mintB.invite.token, 'dave');
  // Connected on B too: search answers the connected only (2026-09-19).
  B.box.streamOpen(daveKey,
    auth.sign(D.people.dave.privateKey, auth.streamMessage(daveKey)), sinkFor([]));

  post(A.box, A.people.jazz, A.key, { search: { q: 'dave' } });
  // A real turn of the loop, not a microtask: the fan-out is a Promise.all
  // over answers that each arrive through their own chain.
  await new Promise(function (r) { setTimeout(r, 0); });
  await new Promise(function (r) { setTimeout(r, 0); });

  const answer = A.inboxes.jazz.filter(function (m) { return m.event === 'reply'; }).pop();
  // Opened: a relay seals its answers now (cycle 10, R5).
  const foundIn = answer && openBody(A.people.jazz, A.key, answer.data.text);
  const found = (foundIn && foundIn.matches || [])
    .filter(function (r) { return r.publicKey === daveKey; })[0];

  if (found) {
    test.check('the search found dave across the partnerships');
  } else {
    test.fail('dave was not found: ' + JSON.stringify(answer && answer.data && answer.data.text));
  }

  if (found && Array.isArray(found.vias) && found.vias.length === 2 &&
      found.vias.indexOf(B.key) !== -1 && found.vias.indexOf(D.key) !== -1) {
    test.check('and named BOTH relays holding him — the second route is not discarded');
  } else {
    test.fail('only one route came back: ' + JSON.stringify(found && { via: found.via, vias: found.vias }));
  }

  // AND AN ORDINARY ANSWER IS UNCHANGED. `vias` is absent when there is
  // one route, so a peer found in one place costs exactly the bytes it
  // always did.
  const sonnyRow = (foundIn && foundIn.matches || [])
    .filter(function (r) { return r.publicLabel === 'sonny'; })[0];
  if (!sonnyRow || sonnyRow.vias === undefined) {
    test.check('and a peer found in one place carries no extra field');
  } else {
    test.fail('vias present for a single route: ' + JSON.stringify(sonnyRow));
  }

  // -- 7. A PEER ON THE RELAY YOU ASKED *AND* ON A PARTNER --------------
  //
  //   Andy: "searching for andy on either lab or spirit should return two
  //   attached relays."
  //
  // The case that matters most in practice, because it is the shape a
  // relay OWNER has: andy is a member of spirit and of lab, so a search
  // from either one finds him twice -- once locally, once through the
  // partnership -- and must come back naming both.
  //
  // `null` is one of the two, and means THE RELAY BEING ASKED. A node
  // already knows which relay it addressed, so naming it again would be
  // 44 characters to say something the reader could not have got wrong.

  test.subHeading('A peer on the asked relay and on a partner names both');

  const andy = auth.generateIdentity('andy');
  ['a', 'b'].forEach(function (tag) {
    const relay = tag === 'a' ? A : B;
    const minted = relay.box.mint('owner' + tag, 'andy', 7, '');
    relay.box.claim('andy', auth.sign(andy.privateKey, auth.claimMessage('andy')),
      andy.publicKey, 'client-andy-' + tag, minted.invite.token, 'andy');
    // And connected on both: search answers the connected only.
    relay.box.streamOpen(andy.publicKey,
      auth.sign(andy.privateKey, auth.streamMessage(andy.publicKey)), sinkFor([]));
  });

  post(A.box, A.people.jazz, A.key, { search: { q: 'andy' } });
  await new Promise(function (r) { setTimeout(r, 0); });
  await new Promise(function (r) { setTimeout(r, 0); });

  const andyReply = A.inboxes.jazz.filter(function (m) { return m.event === 'reply'; }).pop();
  // Opened: a relay seals its answers now (cycle 10, R5). A CARD reply
  // is still read raw above — cards are the one thing that travels plain.
  const andySaid = andyReply && openBody(A.people.jazz, A.key, andyReply.data.text);
  const andyRow = (andySaid && andySaid.matches || [])
    .filter(function (r) { return r.publicKey === andy.publicKey; })[0];

  if (andyRow) {
    test.check('the search found andy, who is on both');
  } else {
    test.fail('andy was not found: ' + JSON.stringify(andyReply && andyReply.data && andyReply.data.text).slice(0, 200));
  }

  if (andyRow && Array.isArray(andyRow.vias) && andyRow.vias.length === 2) {
    test.check('and named two attached relays, exactly as asked');
  } else {
    test.fail('routes for andy: ' + JSON.stringify(andyRow && andyRow.vias));
  }

  if (andyRow && andyRow.vias && andyRow.vias.indexOf(null) !== -1 &&
      andyRow.vias.indexOf(B.key) !== -1) {
    test.check('one of them null -- the relay asked -- and the other the partner');
  } else {
    test.fail('the pair is wrong: ' + JSON.stringify(andyRow && andyRow.vias));
  }

  // -- 8. A ROUTE THAT CARRIED A PACKET IS ANNOUNCED TO EVERYBODY -------
  //
  //   Andy: "what happens if the node, during a peer post, supplies
  //   routes, the relay verifies the first one and it is valid: broadcast
  //   then?"
  //
  // Yes, and it dissolves the boundary it looked like it was bending. The
  // earlier rule was about PROVENANCE -- a member's claim is a hint, a
  // relay's finding is a fact. Verification makes provenance irrelevant:
  // **a false route cannot be verified**, so the only thing anybody can
  // get announced is a route that works.
  //
  // THE BAR IS THE SIGNED REPLY. A partner merely ACCEPTING a forward
  // proves only that it said it holds the key, which a partner harvesting
  // packets would also say. A reply signed by the target cannot be made by
  // anyone who does not hold that key, so this threshold trusts nobody --
  // not even the partner that carried it.

  test.subHeading('A proven route is announced, and only a proven one');

  const heard = [];
  const listener = auth.generateIdentity('listener');
  const mintL = A.box.mint('ownera', 'listener', 7, '');
  A.box.claim('listener', auth.sign(listener.privateKey, auth.claimMessage('listener')),
    listener.publicKey, 'client-listener', mintL.invite.token, 'listener');
  A.box.streamOpen(listener.publicKey,
    auth.sign(listener.privateKey, auth.streamMessage(listener.publicKey)), sinkFor(heard));

  // jazz posts to sonny through the partnership, naming B -- a claim.
  const claimed = post(A.box, A.people.jazz, B.people.sonny.publicKey,
    { card: true }, B.key);

  const beforeReply = heard.filter(function (m) { return m.event === 'route'; }).length;

  if (claimed && claimed.ok && beforeReply === 0) {
    test.check('the packet went, and nothing was announced yet -- a claim is not a fact');
  } else {
    test.fail('announced before it was proven: ' + beforeReply + ' route events');
  }

  // sonny answers, signing over the hash he derived himself.
  const card2 = JSON.stringify({ v: 1, body: { ok: true, name: 'sonny' } });
  B.box.routeReply(B.people.sonny.publicKey, claimed.hash, card2,
    auth.sign(B.people.sonny.privateKey, auth.receiptMessage(claimed.hash)));
  await new Promise(function (r) { setTimeout(r, 0); });
  await new Promise(function (r) { setTimeout(r, 0); });

  const routes = heard.filter(function (m) { return m.event === 'route'; });

  if (routes.length === 1) {
    test.check('and once the signed reply came back, the route was announced');
  } else {
    test.fail(routes.length + ' route events after the reply');
  }

  // IT NAMES THE PEER AND THE PARTNER, and nothing about who asked. A
  // listener learns "sonny is reachable through B", never "jazz wanted
  // him" -- the route is the fact; who wanted it is not anybody's
  // business.
  const ann = routes.length ? routes[0].data : null;

  if (ann && ann.key === B.people.sonny.publicKey && ann.at === B.key) {
    test.check('naming the peer and the partner it was reached through');
  } else {
    test.fail('announcement is wrong: ' + JSON.stringify(ann));
  }

  if (ann && JSON.stringify(ann).indexOf(A.people.jazz.publicKey) === -1) {
    test.check('and saying nothing about who asked for it');
  } else {
    test.fail('the announcement names the requester');
  }

  // AND IT WENT TO A MEMBER WHO HAD NOTHING TO DO WITH IT. That is the
  // whole point: one member paid for the discovery and everybody gets it.
  if (routes.length && heard !== A.inboxes.jazz) {
    test.check('heard by a member who was not party to the exchange');
  } else {
    test.fail('the announcement did not reach an uninvolved member');
  }

  test.reportSuccessFailureCount();
}());
