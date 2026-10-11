'use strict';

// spirit/test/heldStranger.js
// goal/G16.7: the held stranger, no delivered receipt, no kept text (B1, B2 of the review of 2026-10-10), with S12
// and the acquire-known low folded in. Written first, red on today's tree, by claude-windows; the build is the other
// agent's. Andy, 2026-10-10: "words should be only in the traffic log, if they will reasonably be seen, the held peers
// should be receiving an error: request ignored, and the words not entered in the traffic log."
//
// WHAT IS ASSERTED
//   1. A HELD sender's post is answered with the node's own refusal, request ignored (a reply whose body says ok false,
//      code request-ignored, receipted over that text), never the bare receipt a delivered post gets.
//   2. Nothing of theirs is kept: the log row says held and carries no payload; no app is handed it; their waiting row
//      in the address book still appears (the hold's count).
//   3. A known sender is still receipted bare and delivered; a dropped sender is unchanged.
//   4. S12: a BLOCKED sender under the acquire policy reaches no app and gets no row as a newcomer.
//   5. Known means accepted, not heard once: under acquire, a stranger admitted once is still not 'known' to the front
//      door on its next post.
// NOT ASSERTED HERE: the card-ask lows of the box (a card ask passing the front door, one log row); they are named for
// the builder to weigh, not held by this red.
// rule/11: through testSupport only; no node, no ports, fakes as frontDoor.js uses them.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { sealedPost } = require('./openReply');
const peerPost = require('../run/js/peerPost');
const contactBook = require('../run/js/contacts');
const hub = require('../run/js/hub');
const world = require('./world');

const OWED = 'OWED by goal/G16.7: ';
const RELAY = 'http://relay.example';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }

test.startTest('goal/G16.7: the held stranger is told, and nothing of theirs is kept');

function nodeWith(policy) {
  const home = world.tmpHome('heldstranger');
  const me = auth.generateIdentity('andy');
  auth.saveIdentity(home, me);
  if (policy) fs.writeFileSync(path.join(home, 'preferences.json'), JSON.stringify({ unknownSenders: policy }));
  const logged = [], arrived = [], replies = [];
  const router = peerPost.createPeerPost({
    rootDir: home,
    request: function (url, method, pathname, body) {
      if (/\/api\/relay\/reply$/.test(pathname)) replies.push(body);
      return Promise.resolve({ status: 200, text: '{}' });
    },
    traffic: { note: function (e) { logged.push(e); } },
    onArrival: function (item) { arrived.push(item); },
    admit: function (from) { return hub.frontDoor(home, from); },
    remember: function (from, verdict) { return hub.remember(home, from, verdict); },
  });
  return { home: home, me: me, router: router, logged: logged, arrived: arrived, replies: replies };
}
function bodyOf(text) {
  try { const p = JSON.parse(String(text || '')); return p && p.body !== undefined ? p.body : p; } catch (e) { return null; }
}
function receiptOk(reply) {
  try { return auth.receiptSignatureOk(reply.from, reply.hash, String(reply.text || ''), reply.sig); } catch (e) { return false; }
}

async function run() {
  // ── 1 and 2. THE HELD SENDER ───────────────────────────────────────────
  test.subHeading('1. a held sender is answered with the node\'s refusal, request ignored');
  const stranger = auth.generateIdentity('nobody');
  const H = nodeWith('hold');
  await H.router.onRequest(RELAY, sealedPost(stranger, H.me, 'a line from a held stranger'));
  const r = H.replies[0] || null;
  const said = r ? bodyOf(r.text) : null;
  if (r && said && said.ok === false && said.code === 'request-ignored') test.check('the reply to a held sender says ok false, request-ignored');
  else test.fail(OWED + 'the reply to a held sender is ' + short(r && { text: r.text }));
  if (r && receiptOk(r)) test.check('and it is receipted over that text, so the sender can trust it came from this node');
  else test.fail(OWED + 'the refusal is not receipted over its own text');

  test.subHeading('2. nothing of theirs is kept');
  const rows = H.logged.filter(function (e) { return e.dir === 'in' && e.kind === 'request'; });
  if (rows.length === 1 && rows[0].outcome === 'held' && !('payload' in rows[0])) test.check('the log row says held and carries no payload');
  else test.fail(OWED + 'the held arrival is logged as ' + short(rows));
  if (H.arrived.length === 0) test.check('no app is handed it');
  else test.fail('a held line reached an app: ' + short(H.arrived));
  if (contactBook.byPublicKey(H.home, stranger.publicKey)) test.check('and their waiting row is there, which is the hold\'s count');
  else test.fail(OWED + 'no waiting row for the held sender');

  // ── 3. KNOWN AND DROPPED ───────────────────────────────────────────────
  test.subHeading('3. a known sender is still receipted and delivered; a dropped one is unchanged');
  const friend = auth.generateIdentity('bella');
  const K = nodeWith('hold');
  contactBook.acquire(K.home, { publicKey: friend.publicKey, publicLabel: 'bella', relays: [RELAY] }, 'message');
  await K.router.onRequest(RELAY, sealedPost(friend, K.me, 'from a friend'));
  const kr = K.replies[0] || null;
  if (K.arrived.length === 1 && kr && String(kr.text || '') === '' && receiptOk(kr)) test.check('a known sender is delivered and gets the bare receipt');
  else test.fail(OWED + 'a known sender: arrived ' + K.arrived.length + ', reply ' + short(kr && { text: kr.text, ok: receiptOk(kr) }));
  const D = nodeWith('silent');
  await D.router.onRequest(RELAY, sealedPost(stranger, D.me, 'ignored'));
  const drow = D.logged.filter(function (e) { return e.dir === 'in' && e.kind === 'request'; });
  if (D.arrived.length === 0 && drow.length === 1 && drow[0].outcome === 'ignored' && !('payload' in drow[0])) test.check('a dropped sender is logged as ignored with no payload, as before');
  else test.fail('a dropped sender: ' + short(drow));

  // ── 4. S12 ─────────────────────────────────────────────────────────────
  test.subHeading('4. a blocked sender under acquire reaches no app');
  const pest = auth.generateIdentity('pest');
  const B = nodeWith('acquire');
  contactBook.acquire(B.home, { publicKey: pest.publicKey, publicLabel: 'pest', relays: [RELAY] }, 'roll');
  contactBook.setBlocked(B.home, pest.publicKey, true);
  await B.router.onRequest(RELAY, sealedPost(pest, B.me, 'let me in'));
  const brow = contactBook.byPublicKey(B.home, pest.publicKey);
  if (B.arrived.length === 0 && hub.frontDoor(B.home, pest.publicKey) !== 'admit') test.check('a blocked key is turned away first, whatever the policy');
  else test.fail(OWED + 'a blocked key under acquire: arrived ' + B.arrived.length + ', front door says ' + hub.frontDoor(B.home, pest.publicKey));
  if (brow && brow.blocked === true) test.check('and its row stays blocked');
  else test.fail(OWED + 'the blocked row changed: ' + short(brow));

  // ── 5. KNOWN MEANS ACCEPTED ─────────────────────────────────────────────
  test.subHeading('5. under acquire, heard once is not known');
  const visitor = auth.generateIdentity('visitor');
  const A = nodeWith('acquire');
  await A.router.onRequest(RELAY, sealedPost(visitor, A.me, 'hello'));
  if (A.arrived.length === 1) test.check('acquire still admits the stranger\'s line');
  else test.fail('acquire did not admit: ' + A.arrived.length);
  if (hub.frontDoor(A.home, visitor.publicKey) !== 'known') test.check('and the front door does not call them known after one message');
  else test.fail(OWED + 'one message under acquire made the stranger known');
}

run().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
});
