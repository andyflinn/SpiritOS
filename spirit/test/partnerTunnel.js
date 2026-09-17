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
const waiting = {};        // outer hash -> resolve, for a partner's answer

// ── THE WIRE BETWEEN TWO RELAYS, AND THE WAITING IS THE POINT ─────────
//
// A post out, the answer on the held stream — so the answer CANNOT be
// returned here. B parks a forward until its own member speaks, which may
// be much later, and the reply then arrives as an event on the stream A
// holds to B. That is `partnerLink.onEvent -> router.onReply` in the real
// system, and this models it rather than short-circuiting it: had the
// fixture returned the answer inline, it would have proven a path the
// product does not have.
function askPartner(fromHome) {
  return function (url, relayKey, text) {
    const me = auth.loadIdentity(fromHome);
    const target = boxes[relayKey];
    if (!target) return Promise.resolve(null);
    const sig = auth.sign(me.privateKey, auth.postMessage(me.publicKey, relayKey, text));
    const posted = target.routePost(me.publicKey, relayKey, text, sig);
    if (!posted || !posted.ok) return Promise.resolve(null);
    return new Promise(function (resolve) { waiting[posted.hash] = resolve; });
  };
}

// A stream one relay holds to another. Replies on it settle the promise
// `askPartner` handed back — which is the whole of how a partner answers.
function partnerSink() {
  return {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (!ev || ev[1] !== 'reply') return true;
      let parsed = null;
      try { parsed = da ? JSON.parse(da[1]) : null; } catch (e) { parsed = null; }
      if (parsed && waiting[parsed.hash]) {
        const resolve = waiting[parsed.hash];
        delete waiting[parsed.hash];
        resolve({ text: parsed.text });
      }
      return true;
    },
    close: function () {},
  };
}

function relayWith(tag, memberNames) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-tunnel-' + tag + '-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay-' + tag));

  const owner = auth.generateIdentity('owner-' + tag);
  auth.writeAllowKeys(home, [{ name: 'owner' + tag, publicKey: owner.publicKey }]);

  const box = createRelay(home, { askPartner: askPartner(home) });
  box.claim('owner' + tag, auth.sign(owner.privateKey, auth.claimMessage('owner' + tag)), owner.publicKey);

  const people = {};
  const inboxes = {};
  (memberNames || []).forEach(function (name) {
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner' + tag, name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, null, minted.invite.token, name);
    people[name] = id;
    inboxes[name] = [];
    box.streamOpen(id.publicKey,
      auth.sign(id.privateKey, auth.streamMessage(id.publicKey)), sinkFor(inboxes[name]));
  });

  boxes[box.relayPublicKey()] = box;
  return { home, box, owner, people, inboxes, key: box.relayPublicKey() };
}

function post(box, from, toKey, bodyObj) {
  const text = JSON.stringify({ v: 1, body: bodyObj });
  return box.routePost(from.publicKey, toKey, text,
    auth.sign(from.privateKey, auth.postMessage(from.publicKey, toKey, text)));
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

const okA = A.box.setPartner(A.owner, B.owner.publicKey, 'http://b.example', B.key, 'h1');
const okB = B.box.setPartner(B.owner, A.owner.publicKey, 'http://a.example', A.key, 'h2');
if (!okA.ok || !okB.ok) {
  test.fail('the fixture did not partner them: ' + JSON.stringify(okA) + ' / ' + JSON.stringify(okB));
}

// ── AND ONLY NOW DO THEY DIAL ────────────────────────────────────────
//
// AFTER the promotion, never before — and getting this wrong is what
// cost an hour: `streamOpen` resolves a caller as a member or as a PINNED
// partner, so a relay dialling before it has been promoted is simply
// nobody and is refused. The stream then does not exist, and a forward's
// answer has nowhere to go — which looks exactly like a broken tunnel
// and is a fixture that never plugged the cable in.
//
// partnerLink has the same ordering for the same reason: it opens streams
// at boot and again on promotion, never speculatively.
function dial(host, guestHome, what) {
  const guest = auth.loadIdentity(guestHome);
  const opened = host.box.streamOpen(guest.publicKey,
    auth.sign(guest.privateKey, auth.streamMessage(guest.publicKey)), partnerSink());
  if (!opened || !opened.ok) test.fail(what + ' could not hold a stream: ' + JSON.stringify(opened));
  return opened;
}
dial(B, A.home, 'A on B');
dial(A, B.home, 'B on A');

// ── 1. THE PACKET ARRIVES ────────────────────────────────────────────

test.subHeading('jazz posts to sonny, who is on nobody jazz has ever heard of');

const sent = post(A.box, A.people.jazz, B.people.sonny.publicKey, { describe: true });

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

  post(A.box, A.people.jazz, C.people.carol.publicKey, { describe: true });
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

  test.reportSuccessFailureCount();
}());
