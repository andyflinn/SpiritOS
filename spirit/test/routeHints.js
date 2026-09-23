'use strict';

// spirit/test/routeHints.js
// CYCLE 2: ROUTE HINTS, SIGNED BESIDE THE PACKET, CHOSEN BY THE RELAY.
//
//   Andy: "the route hints are actually more like an address-prefix, or
//   'location', like a domain in DNS." — "1. live partners 2. minted
//   partners 3. non-minted, immediately returns error ('minting
//   incomplete')."
//
// design/cycles/2026-09-19-route-hints-cycle-2.md. In process, with the
// same injected `askPartner` partnerTunnel.js uses, so every hop is a real
// signed post. The wire version is hintWire.js.
//
// What it proves:
//   - a hint block is refused unsigned, lifted off another packet, or over
//     the bound
//   - hints naming no partner of this relay: 409 "minting incomplete"
//   - a live partner is chosen before a minted one, and only ONE is used
//   - a minted partner is used when no hinted partner is live
//   - a target on this relay is delivered locally whatever the hints say
//   - a packet that would not fit once tunnelled is refused before it
//     leaves, by the relay and by a node's peerPost at compose
//   - peerPost sends hints with a signature the relay accepts

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const limits = require('../run/js/limits.js');
const { createRelay } = require('../run/js/relay');
const { createPeerPost } = require('../run/js/peerPost');
const relayStore = require('../run/js/relayStore');

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

const boxes = {};
const carriedTo = [];   // which relay each forward was handed to
// What each partner said back, as the reply to the post that asked (R13):
// the promise routePost hands a partner, kept so a case can read it.
const heldAnswers = [];

function askPartner(fromHome) {
  return function (url, relayKey, text) {
    carriedTo.push(relayKey);
    const me = auth.loadIdentity(fromHome);
    const target = boxes[relayKey];
    if (!target) return Promise.resolve(null);
    const sig = auth.sign(me.privateKey, auth.postMessage(me.publicKey, relayKey, text));
    const posted = target.routePost(me.publicKey, relayKey, text, sig);
    if (posted && posted.held) heldAnswers.push(posted.held);
    // ANSWERS, RATHER THAN HANGING FOR EVER.
    //
    // This was `new Promise(function () {})` — "the answer is not under
    // test here" — which left the forwarding route on A open until its
    // ttl. Invisible while a member could be asked sixteen things at
    // once; at one (0016) the next case in this file was refused `target
    // is busy`, and the suite reported a ROUTING failure that was really
    // a fixture holding its own slot.
    //
    // `null` is a shape this function already returns when it does not
    // know the partner, and the relay handles it: relayErrorToAsker tells
    // jazz the partner did not answer, and the route closes. What this
    // file checks — which partner a hint selects, and that sonny received
    // it — is untouched, because it is checked before the answer.
    return Promise.resolve(null);
  };
}

function relayWith(tag, memberNames) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-hints-' + tag + '-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay-' + tag));
  const owner = auth.generateIdentity('owner-' + tag);
  auth.writeAllowKeys(home, [{ name: 'owner' + tag, publicKey: owner.publicKey }]);
  const box = createRelay(home, { askPartner: askPartner(home) });
  box.claim('owner' + tag, auth.sign(owner.privateKey, auth.claimMessage('owner' + tag)), owner.publicKey);
  const people = {};
  const inboxes = {};
  (memberNames || []).forEach(function (name) { add(name); });
  function add(name, identity) {
    const id = identity || auth.generateIdentity(name);
    const minted = box.mint('owner' + tag, name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, 'fx-' + tag + '-' + name, minted.invite.token, name);
    people[name] = id;
    inboxes[name] = [];
    box.streamOpen(id.publicKey, auth.sign(id.privateKey, auth.streamMessage(id.publicKey)),
      sinkFor(inboxes[name]));
  }
  boxes[box.relayPublicKey()] = box;
  return { tag, home, box, owner, people, inboxes, add, key: box.relayPublicKey() };
}

function enrol(relay, identity, name) {
  const minted = relay.box.mint('owner' + relay.tag, name, 7, '');
  return relay.box.claim(name, auth.sign(identity.privateKey, auth.claimMessage(name)),
    identity.publicKey, 'fx-x-' + relay.tag + '-' + name, minted.invite.token, name);
}

function partner(X, Y) {
  enrol(Y, X.owner, 'owner' + X.tag);
  enrol(X, Y.owner, 'owner' + Y.tag);
  X.box.setPartner(X.owner, Y.owner.publicKey, 'http://' + Y.tag + '.example', Y.key, 'p' + X.tag + Y.tag);
  Y.box.setPartner(Y.owner, X.owner.publicKey, 'http://' + X.tag + '.example', X.key, 'p' + Y.tag + X.tag);
}

// WHAT "LIVE" MEANS FROM X'S SIDE (R13). It was "Y holds a stream on X";
// partners hold none now. Live is "answered within fifteen minutes, or has
// not failed its one try since" (relay.js, partnerLive) — so Y is made live
// by stamping its last answer on X's roll, which is what a real answer does.
function answeredJustNow(X, Y) {
  return relayStore.open(X.home).partners.touch(Y.key);
}

// A signed post with a signed hint block — what peerPost puts on the wire.
function post(box, from, toKey, bodyObj, hints, opts) {
  const o = opts || {};
  const text = o.text || JSON.stringify({ v: 1, body: bodyObj });
  const sig = auth.sign(from.privateKey, auth.postMessage(from.publicKey, toKey, text));
  let route;
  if (hints) {
    const hintSig = o.unsigned ? undefined
      : auth.sign(from.privateKey, auth.hintMessage(o.signOver || sig, hints));
    route = { hints: hints, hintSig: hintSig };
  }
  return box.routePost(from.publicKey, toKey, text, sig, route);
}

function requests(bag) { return bag.filter(function (m) { return m.event === 'request'; }).length; }

// LET THE PREVIOUS FORWARD FINISH BEFORE ASKING THE SAME PEER AGAIN.
//
// A forward is handed to `askPartner`, which answers a PROMISE, while
// `routePost` returns synchronously — so the route to sonny is still open
// when the next case runs on the same tick. Harmless while a member could
// be asked sixteen things at once; at one (0016) the second case is
// refused `target is busy` and the suite reports a routing failure that
// is really a fixture racing itself.
//
// A macrotask rather than a microtask, so the whole settle chain drains
// and not just its first link.
function settled() { return new Promise(function (r) { setTimeout(r, 0); }); }

// SOMEBODY HAS TO ANSWER, or the far relay's slot for that member stays
// taken and the next case is refused there instead of here.
//
// These cases forward jazz -> A -> B -> sonny, and sonny never replied:
// the check was only ever that the request ARRIVED. At sixteen routes per
// member nothing noticed; at one (0016) the second forward to sonny is
// refused on B, and the failure reads as a routing bug on A.
//
// So sonny answers, which is what a member does. The hash is derived from
// the bytes that arrived — never taken from the wire (0011) — exactly as
// a real node derives it.
const answered = new WeakMap();
function answerPending(box, id, inbox) {
  const from = answered.get(inbox) || 0;
  for (let i = from; i < inbox.length; i += 1) {
    const m = inbox[i];
    if (!m || m.event !== 'request' || !m.data) continue;
    const d = m.data;
    const verified = auth.postSignatureFor(d.from, d.from, d.to, d.text, d.sig);
    if (!verified) continue;
    const hash = auth.requestHash(verified);
    box.routeReply(id.publicKey, hash, 'ok',
      auth.sign(id.privateKey, auth.receiptMessage(hash)));
  }
  answered.set(inbox, inbox.length);
}

test.startTest('Route hints — signed beside the packet, chosen by the relay');

async function run() {
  // A holds jazz and kim. B and D both hold sonny. B is a LIVE partner of
  // A (it answered a moment ago); D is a partner of A that is not live (it
  // has never answered, and failed its one try). C is nobody's partner.
  const A = relayWith('a', ['jazz', 'kim']);
  const B = relayWith('b', ['sonny']);
  const D = relayWith('d', []);
  D.add('sonny', B.people.sonny);
  const C = relayWith('c', []);
  partner(A, B);
  partner(A, D);
  if (!answeredJustNow(A, B)) test.fail('fixture: could not stamp B as answered on A');
  const sonny = B.people.sonny.publicKey;
  // D's one try, spent and failed: a member of A searches, A asks both
  // partners (neither has failed yet), and this fixture's partners say
  // nothing. B stays live on its fresh answer; D is benched.
  post(A.box, A.people.kim, A.key, { search: { q: 'anyone' } });
  await settled();
  await settled();

  test.subHeading('A hint block the relay must not act on');

  const unsigned = post(A.box, A.people.jazz, sonny, { card: true }, [B.key], { unsigned: true });
  if (!unsigned.ok && unsigned.status === 403 && /hint signature/.test(unsigned.error)) {
    test.check('unsigned hints: 403 "' + unsigned.error + '"');
  } else {
    test.fail('unsigned hints accepted: ' + JSON.stringify(unsigned));
  }

  await settled();
  answerPending(B.box, B.people.sonny, B.inboxes.sonny);
  const lifted = post(A.box, A.people.jazz, sonny, { card: true }, [B.key],
    { signOver: 'a-signature-from-some-other-packet' });
  if (!lifted.ok && lifted.status === 403) {
    test.check('hints signed for another packet: refused — a hint block cannot be lifted');
  } else {
    test.fail('lifted hints accepted: ' + JSON.stringify(lifted));
  }

  await settled();
  answerPending(B.box, B.people.sonny, B.inboxes.sonny);
  const tooMany = post(A.box, A.people.jazz, sonny, { card: true },
    [B.key, D.key, C.key, 'k4', 'k5'].slice(0, limits.HINTS_PER_POST + 1));
  if (!tooMany.ok && tooMany.status === 400) {
    test.check('more than HINTS_PER_POST (' + limits.HINTS_PER_POST + '): 400');
  } else {
    test.fail('over-bound hints accepted: ' + JSON.stringify(tooMany));
  }

  test.subHeading('No hinted relay is a partner of mine: "minting incomplete"');

  await settled();
  answerPending(B.box, B.people.sonny, B.inboxes.sonny);
  const notMine = post(A.box, A.people.jazz, sonny, { card: true }, [C.key]);
  if (!notMine.ok && notMine.status === 409 && notMine.error === 'minting incomplete') {
    test.check('hint naming only C: 409 "minting incomplete", at once');
  } else {
    test.fail('non-partner hint: ' + JSON.stringify(notMine));
  }

  test.subHeading('Live partner before minted, and only one');

  carriedTo.length = 0;
  await settled();
  answerPending(B.box, B.people.sonny, B.inboxes.sonny);
  const both = post(A.box, A.people.jazz, sonny, { card: true }, [D.key, B.key]);
  if (both.ok && carriedTo.length === 1 && carriedTo[0] === B.key) {
    test.check('hints [D, B]: carried to B alone — B is live, D is only minted');
  } else {
    test.fail('tier order: ' + JSON.stringify(both) + ' carried to ' + JSON.stringify(carriedTo));
  }
  if (requests(B.inboxes.sonny) === 1) {
    test.check('and sonny on B received it');
  } else {
    test.fail('sonny on B saw ' + requests(B.inboxes.sonny) + ' requests');
  }

  carriedTo.length = 0;
  await settled();
  answerPending(B.box, B.people.sonny, B.inboxes.sonny);
  const mintedOnly = post(A.box, A.people.jazz, sonny, { describe: 'again' }, [D.key]);
  if (mintedOnly.ok && carriedTo[0] === D.key) {
    test.check('hints [D] only: carried to D — a minted partner, when none is live');
  } else {
    test.fail('minted tier: ' + JSON.stringify(mintedOnly) + ' carried to ' + JSON.stringify(carriedTo));
  }

  test.subHeading('A target on this relay is delivered here, whatever the hints say');

  carriedTo.length = 0;
  const local = post(A.box, A.people.jazz, A.people.kim.publicKey, { hello: 1 }, [C.key]);
  if (local.ok && carriedTo.length === 0 && requests(A.inboxes.kim) === 1) {
    test.check('jazz to kim with a hint naming C: delivered locally, nothing carried');
  } else {
    test.fail('local delivery: ' + JSON.stringify(local) + ' carried ' + JSON.stringify(carriedTo));
  }

  test.subHeading('A packet that would not survive the tunnel never leaves');

  const long = 'a'.repeat(16000);
  const stuffed = '"'.repeat(9000);
  const someKey = A.people.jazz.publicKey;
  const someSig = auth.sign(A.people.jazz.privateKey, 'x');
  if (limits.fitsWrapped(long, someKey, someKey, someSig) &&
      !limits.fitsWrapped(stuffed, someKey, someKey, someSig)) {
    test.check('fitsWrapped: a 16,000-byte message fits wrapped; 9,000 quotes do not — measured, not a constant');
  } else {
    test.fail('fitsWrapped is wrong on the two cases');
  }

  carriedTo.length = 0;
  await settled();
  answerPending(B.box, B.people.sonny, B.inboxes.sonny);
  const big = post(A.box, A.people.jazz, sonny, null, [B.key], { text: stuffed });
  if (!big.ok && big.status === 413 && carriedTo.length === 0) {
    test.check('the relay refuses it before carrying: 413 "' + big.error + '"');
  } else {
    test.fail('oversize tunnel: ' + JSON.stringify(big) + ' carried ' + JSON.stringify(carriedTo));
  }

  test.subHeading('A node’s peerPost: refuses at compose, and signs its hints');

  const nodeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-hints-node-'));
  auth.saveIdentity(nodeHome, A.people.jazz);
  const sent = [];
  const pp = createPeerPost({
    rootDir: nodeHome,
    checkTunnel: true,
    waitMs: 50,
    request: function (url, method, p, body) {
      sent.push(body);
      return Promise.resolve({ status: 202, text: '{}' });
    },
  });

  return pp.post('http://a.example', sonny, stuffed).then(function (r) {
    if (!r.ok && r.status === 413 && sent.length === 0) {
      test.check('a packet that would not fit wrapped: 413 at compose, nothing sent');
    } else {
      test.fail('compose check: ' + JSON.stringify(r) + ', sent ' + sent.length);
    }
    return pp.post('http://a.example', sonny, JSON.stringify({ v: 1, body: { hi: 1 } }), [B.key, D.key]);
  }).then(function () {
    const b = sent[0] || {};
    const ok = Array.isArray(b.hints) && b.hints.length === 2 &&
      auth.hintsSigned(A.people.jazz.publicKey, b.sig, b.hints, b.hintSig);
    if (ok) {
      test.check('hints sent beside the packet with a signature the relay will accept');
    } else {
      test.fail('peerPost body: ' + JSON.stringify(b));
    }
    const routed = A.box.routePost(b.from, b.to, b.text, b.sig, { hints: b.hints, hintSig: b.hintSig });
    if (routed && routed.ok) {
      test.check('and the relay takes that exact body: ' + routed.status);
    } else {
      test.fail('relay refused peerPost’s own body: ' + JSON.stringify(routed));
    }
    return replyDirection(A, B);
  }).then(function () {
    test.reportSuccessFailureCount();
  });
}

// ── THE SAME CHECK ON THE WAY BACK ───────────────────────────────────
//
// A reply to a tunnelled post is wrapped whole into the far relay's answer
// to its partner, so it can fail on the return exactly as a post can on
// the way out. Covered at both places it can be caught: the far relay, and
// the replying node at compose.
async function replyDirection(A, B) {
  test.subHeading('A reply that would not survive the return tunnel');

  const plain = 'a'.repeat(16000);
  const stuffed = '"'.repeat(8300);
  const k = A.people.jazz.publicKey;
  const s = auth.sign(A.people.jazz.privateKey, 'x');
  if (limits.fitsWrappedReply(plain, k, s) && !limits.fitsWrappedReply(stuffed, k, s)) {
    test.check('fitsWrappedReply: 16,000 plain bytes fit the return wrapper; 8,300 quotes do not');
  } else {
    test.fail('fitsWrappedReply is wrong on the two cases');
  }

  // B's answer to A is the reply to A's own post (R13): the fixture keeps
  // each one, so the case below reads the one this forward gets.

  // One member may be asked one thing at a time (0016), and the cases
  // above have been asking sonny. Let the last of them close before this
  // one asks again.
  await settled();
  answerPending(B.box, B.people.sonny, B.inboxes.sonny);
  const before = B.inboxes.sonny.length;
  const heldBefore = heldAnswers.length;
  const sent = post(A.box, A.people.jazz, B.people.sonny.publicKey, { ask: 'big' }, [B.key]);
  const req = B.inboxes.sonny.slice(before).filter(function (m) { return m.event === 'request'; })[0];
  if (!sent.ok || !req) {
    test.fail('fixture: the forward did not reach sonny: ' + JSON.stringify(sent));
    return Promise.resolve();
  }
  const d = req.data;
  const innerHash = auth.requestHash(auth.postSignatureFor(d.from, d.from, d.to, d.text, d.sig));
  const receipt = auth.sign(B.people.sonny.privateKey, auth.receiptMessage(innerHash));

  const replied = B.box.routeReply(B.people.sonny.publicKey, innerHash, stuffed, receipt);
  if (!replied.ok && replied.status === 413 && /tunnel/.test(replied.error)) {
    test.check('the far relay refuses it to the replier: 413 "' + replied.error + '"');
  } else {
    test.fail('oversize reply accepted: ' + JSON.stringify(replied));
  }
  const packet = heldAnswers.length > heldBefore ? await heldAnswers[heldAnswers.length - 1] : null;
  let told = null;
  try { told = JSON.parse(packet.text).body; } catch (e) { told = null; }
  if (told && told.ok === false && told.status === 413) {
    test.check('and tells the partner relay why, which passes it down the chain (hintWire.js proves the rest)');
  } else {
    test.fail('partner not told: ' + JSON.stringify(told));
  }

  // The replying node, at compose: an answer too big for the return is not
  // sent; the receipt goes with no text, and the log says why.
  const replierHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-hints-replier-'));
  auth.saveIdentity(replierHome, B.people.sonny);
  const out = [];
  function replier(checkTunnel) {
    return createPeerPost({
      rootDir: replierHome,
      checkTunnel: checkTunnel,
      answer: function () { return stuffed; },
      request: function (url, method, p, body) {
        if (p === '/api/relay/reply') out.push(body);
        return Promise.resolve({ status: 200, text: '{}' });
      },
    });
  }
  const ask = (function () {
    const text = JSON.stringify({ v: 1, body: { ask: 'big' } });
    const to = B.people.sonny.publicKey;
    return { from: k, to: to, text: text,
      sig: auth.sign(A.people.jazz.privateKey, auth.postMessage(k, to, text)) };
  }());
  return replier(true).onRequest('http://b.example', ask).then(function () {
    const withCheck = out.pop();
    return replier(false).onRequest('http://b.example', ask).then(function () {
      const without = out.pop();
      if (withCheck && withCheck.text === '' && without && without.text === stuffed) {
        test.check('the replying node sends the receipt without the oversize answer — only when checking, as a node does');
      } else {
        test.fail('compose check on replies: with ' + JSON.stringify(withCheck && withCheck.text.length) +
          ', without ' + JSON.stringify(without && without.text.length));
      }
    });
  }).then(function () {
    // THE ASKING NODE, when the error comes down the chain: a reply for its
    // hash signed by the RELAY, not by the target. Settled as a failure,
    // marked `relayed`, never mistaken for the target's answer.
    const askerHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-hints-asker-'));
    auth.saveIdentity(askerHome, A.people.jazz);
    const asked = [];
    const asker = createPeerPost({
      rootDir: askerHome,
      waitMs: 2000,
      request: function (url, method, p, body) {
        asked.push(body);
        return Promise.resolve({ status: 202, text: '{}' });
      },
    });
    const to = B.people.sonny.publicKey;
    const text = JSON.stringify({ v: 1, body: { ask: 1 } });
    const waiting = asker.post('http://a.example', to, text);
    return Promise.resolve().then(function () {
      const b = asked[0];
      const hash = auth.requestHash(auth.postSignatureFor(b.from, b.from, b.to, b.text, b.sig));
      const relayId = auth.loadIdentity(A.home);
      asker.onReply({
        hash: hash,
        from: relayId.publicKey,
        text: JSON.stringify({ v: 1, body: { ok: false, status: 413, error: 'reply was oversized', relayed: true } }),
        sig: auth.sign(relayId.privateKey, auth.receiptMessage(hash)),
      });
      return waiting;
    }).then(function (r) {
      if (r && r.ok === false && r.relayed && r.error === 'reply was oversized' && r.status === 413) {
        test.check('the asking node settles it as a failure, marked relayed: "' + r.error + '"');
      } else {
        test.fail('asker settled: ' + JSON.stringify(r));
      }
    });
  });
}

Promise.resolve().then(run).catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
