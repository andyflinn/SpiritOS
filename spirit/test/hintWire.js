'use strict';

// spirit/test/hintWire.js
// CYCLE 2 OVER REAL SOCKETS: A HINTED POST CROSSES A PARTNERSHIP AND IS
// ANSWERED.
//
// design/cycles/2026-09-19-route-hints-cycle-2.md. Two relay processes,
// partnered the old way as a fixture (acquisition is cycle 5). alice is on
// A, bertrand on B, and nothing on A knows bertrand — the route hint is the
// only thing that says where he is.
//
// What a green run proves:
//   1. POST /api/relay/post accepts `hints` + `hintSig` from the wire
//   2. A carries it to B; bertrand receives it and replies
//   3. the reply comes back to alice on the stream she holds
//   4. A announces the proven route — and another member of A (amy) hears
//      `{ key: bertrand, at: <B's relay key> }`, which is what her node
//      would stash on her contact row (routeStash.js)
//   5. a hint naming no partner of A: 409 "minting incomplete"
//   6. a packet that would not survive the tunnel: 413 at A, never at B
//
// Through the interface only: hub.relayRequest and sseClient (oneDoor).

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const hub = require('../run/js/hub');
const buildStamp = require('../run/js/buildStamp');
const sseClient = require('../run/js/sseClient');
const { createRelay } = require('../run/js/relay');

const REPO_RUN = path.join(__dirname, '..', 'run');
const PORTS = [65481, 65482];

let kids = [];
let streams = [];
function cleanup() {
  streams.forEach(function (s) { try { s.close(); } catch (e) { /* gone */ } });
  streams = [];
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  kids = [];
}
process.on('exit', cleanup);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function buildRelay(tag, memberNames) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-hw-' + tag + '-'));
  const box = createRelay(home);
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner' + tag);
  auth.writeAllowKeys(home, [{ name: 'owner' + tag, publicKey: owner.publicKey }]);
  box.claim('owner' + tag, auth.sign(owner.privateKey, auth.claimMessage('owner' + tag)),
    owner.publicKey, 'fx-owner' + tag);
  const members = {};
  (memberNames || []).forEach(function (name) {
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner' + tag, name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, 'fx-' + name, minted.invite.token, name);
    members[name] = id;
  });
  return { tag: tag, home: home, box: box, owner: owner, members: members };
}

function plant(w) {
  const runDir = path.join(w.home, 'spirit', 'run');
  fs.cpSync(REPO_RUN, runDir, { recursive: true });
  fs.rmSync(path.join(runDir, 'relay-state'), { recursive: true, force: true });
  fs.cpSync(path.join(w.home, 'relay-state'), path.join(runDir, 'relay-state'), { recursive: true });
  const mine = buildStamp.fromGit(path.join(__dirname, '..', '..'));
  if (mine) buildStamp.write(runDir, mine);
  w.runDir = runDir;
}

async function startRelay(w, port) {
  const kid = spawn(process.execPath, ['js/relayServer.js', '--port', String(port)],
    { cwd: w.runDir, stdio: 'ignore' });
  kids.push(kid);
  const base = 'http://127.0.0.1:' + port;
  for (let n = 0; n < 40; n += 1) {
    await sleep(200);
    try {
      const r = await hub.relayRequest(base, 'GET', '/api/relay/key', null);
      if (r.status === 200) { w.base = base; return base; }
    } catch (e) { /* not up yet */ }
  }
  return null;
}

function hold(w, identity, onEvent) {
  const s = sseClient.connect({
    url: w.base + '/api/relay/stream?key=' + encodeURIComponent(identity.publicKey),
    headers: function () {
      return { 'X-Spirit-Sig': auth.sign(identity.privateKey, auth.streamMessage(identity.publicKey)) };
    },
    onEvent: onEvent,
  });
  streams.push(s);
  return s;
}

// What peerPost puts on the wire: the signed packet, and the hints signed
// beside it over the packet's own signature.
function postWithHints(w, from, toKey, text, hints) {
  const sig = auth.sign(from.privateKey, auth.postMessage(from.publicKey, toKey, text));
  const body = { from: from.publicKey, to: toKey, text: text, sig: sig };
  if (hints) {
    body.hints = hints;
    body.hintSig = auth.sign(from.privateKey, auth.hintMessage(sig, hints));
  }
  return hub.relayRequest(w.base, 'POST', '/api/relay/post', body).then(function (r) {
    return { status: r.status, body: (function () { try { return JSON.parse(r.text); } catch (e) { return {}; } }()) };
  });
}

async function until(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await sleep(100); }
  return !!fn();
}

test.startTest('Route hints on the wire — a hinted post crosses and is answered');

async function run() {
  test.subHeading('Two relays, partnered; alice and amy on A, bertrand on B');

  const A = buildRelay('a', ['alice', 'amy']);
  const B = buildRelay('b', ['bertrand']);
  // The old model, as a fixture: each owner a member of the other's relay,
  // then promoted. Deprecated (NODE-AND-RELAY §6) and used here only
  // because acquisition is cycle 5.
  [[B, A.owner, 'ownera'], [A, B.owner, 'ownerb']].forEach(function (p) {
    const minted = p[0].box.mint('owner' + p[0].tag, p[2], 7, '');
    p[0].box.claim(p[2], auth.sign(p[1].privateKey, auth.claimMessage(p[2])),
      p[1].publicKey, 'fx-x-' + p[2], minted.invite.token, p[2]);
  });
  const urlA = 'http://127.0.0.1:' + PORTS[0];
  const urlB = 'http://127.0.0.1:' + PORTS[1];
  const okA = A.box.setPartner(A.owner, B.owner.publicKey, urlB, B.box.relayPublicKey(), 'h1');
  const okB = B.box.setPartner(B.owner, A.owner.publicKey, urlA, A.box.relayPublicKey(), 'h2');
  if (!okA.ok || !okB.ok) {
    test.fail('partnership fixture: ' + JSON.stringify(okA) + ' / ' + JSON.stringify(okB));
    cleanup(); test.reportSuccessFailureCount(); return;
  }
  plant(A); plant(B);
  if (!(await startRelay(A, PORTS[0])) || !(await startRelay(B, PORTS[1]))) {
    test.fail('a relay did not come up'); cleanup(); test.reportSuccessFailureCount(); return;
  }
  await sleep(1500);   // each dials the other at boot — that is what makes B live on A
  test.check('both relays up, partnered, dialled');

  const bKey = B.box.relayPublicKey();
  const alice = A.members.alice;
  const amy = A.members.amy;
  const bertrand = B.members.bertrand;

  // bertrand answers whatever reaches him, signed over the hash he derives
  // from the bytes that arrived (0011).
  hold(B, bertrand, function (msg) {
    if (msg.event !== 'request' || !msg.data) return;
    const d = msg.data;
    const verified = auth.postSignatureFor(d.from, d.from, d.to, d.text, d.sig);
    if (!verified) return;
    const hash = auth.requestHash(verified);
    hub.relayRequest(B.base, 'POST', '/api/relay/reply', {
      from: bertrand.publicKey, hash: hash, text: JSON.stringify({ v: 1, body: { hello: 'alice' } }),
      sig: auth.sign(bertrand.privateKey, auth.receiptMessage(hash)),
    }).catch(function () {});
  });

  let aliceReply = null;
  hold(A, alice, function (msg) { if (msg.event === 'reply') aliceReply = msg.data; });
  let amyRoute = null;
  hold(A, amy, function (msg) { if (msg.event === 'route') amyRoute = msg.data; });
  await sleep(600);

  test.subHeading('alice posts to bertrand, hinting B');

  const sent = await postWithHints(A, alice, bertrand.publicKey,
    JSON.stringify({ v: 1, body: { describe: true } }), [bKey]);
  if (sent.status >= 200 && sent.status < 300) {
    test.check('A accepted the hinted post from the wire: ' + sent.status);
  } else {
    test.fail('A refused the hinted post: ' + sent.status + ' ' + JSON.stringify(sent.body));
  }

  await until(function () { return !!aliceReply; }, 6000);
  if (aliceReply && /hello/.test(aliceReply.text || '')) {
    test.check('bertrand answered, and the reply came back to alice across the partnership');
  } else {
    test.fail('no reply at alice: ' + JSON.stringify(aliceReply));
  }

  await until(function () { return !!amyRoute; }, 3000);
  if (amyRoute && amyRoute.key === bertrand.publicKey && amyRoute.at === bKey) {
    test.check('A announced the proven route; amy heard { key: bertrand, at: B’s relay key }');
  } else {
    test.fail('route announcement at amy: ' + JSON.stringify(amyRoute));
  }

  test.subHeading('What A refuses at once');

  const stranger = auth.generateIdentity('nobody').publicKey;
  const notMine = await postWithHints(A, alice, bertrand.publicKey,
    JSON.stringify({ v: 1, body: { describe: true } }), [stranger]);
  if (notMine.status === 409 && notMine.body.error === 'minting incomplete') {
    test.check('a hint naming no partner of A: 409 "minting incomplete"');
  } else {
    test.fail('non-partner hint: ' + notMine.status + ' ' + JSON.stringify(notMine.body));
  }

  // 8,300 quotes: escaped once for the wire it is ~17 KB, under the body cap
  // (PAYLOAD_MAX + headroom + hints); escaped again inside the tunnel
  // wrapper it is ~16.9 KB, over PAYLOAD_MAX. So it passes the socket and
  // fails only the tunnel check — the case that would otherwise 413 at B.
  // (At 9,000 the body cap refuses it first, which proves the wrong thing.)
  const stuffed = await postWithHints(A, alice, bertrand.publicKey, '"'.repeat(8300), [bKey]);
  if (stuffed.status === 413 && /tunnel/.test(stuffed.body.error || '')) {
    test.check('a packet that would not survive the tunnel: 413 at A, before B ever sees it');
  } else {
    test.fail('oversize tunnel: ' + stuffed.status + ' ' + JSON.stringify(stuffed.body));
  }

  cleanup();
  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  cleanup();
  test.fail('hintWire threw: ' + ((e && e.stack) || e));
  test.reportSuccessFailureCount();
});
