'use strict';

// spirit/test/partnerWire.js
// TWO RELAY PROCESSES, TWO SOCKETS, AND A SEARCH THAT CROSSES BETWEEN THEM.
//
//   Andy: "no escaping from the rules for prototyping."
//
//   (Andy, earlier: "Both partners must have the mutual sseClients alive
//   in this pass." Superseded 2026-09-22 by R13, cycle 8: Grok's review,
//   "A held stream is a second bus", agreed by Andy. Partners hold no
//   streams; a partner's answer is the reply to the post that asked.)
//
// ── WHY THIS FILE EXISTS AND partnerGate.js IS NOT ENOUGH ────────────
//
// partnerGate.js proves B's gates by calling `B.box.routePost(...)` — in
// process, on B's own object, through a door no partner will ever use. It
// proves the gates and nothing about a partnership, and it was shipped as
// verification, which was the fault Andy named. This file is what that
// should have been.
//
// A FIRST DRAFT OF THIS FILE CONCEDED that two relays could not have
// separate state, because server.js pins its root to its own location —
// and then asserted the weak things it could. That was the same
// compromise wearing a different hat. presenceWire had already solved it:
// COPY spirit/run per relay, so each process is a whole tree with its own
// relay-state, and two relays are two boxes in every sense that matters.
//
// ── WHAT A GREEN RUN HERE PROVES ────────────────────────────────────
//
//   1. Nobody dialled anybody: neither relay holds a stream to the other.
//   2. B admitted a signer that is not a member, on a PINNED key.
//   3. A member of A asked for a peer that exists only on B.
//   4. A asked B through peerPost over relayRequest: signed, hashed, and
//      dispatched back to that exact question.
//   5. The answer arrived as B's reply to A's own post, held open until B
//      had it — the only place it can arrive now there is no stream.
//   6. A merged it and told its member which partner supplied the row.
//
// No stub can fake it, because there is none: every byte crosses a
// loopback socket between two operating-system processes.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { claimOwner } = require('./ownerClaim');
const hub = require('../run/js/hub');
const buildStamp = require('../run/js/buildStamp');
const plantRun = require('./plantRun');
const sseClient = require('../run/js/sseClient');
const { createRelay } = require('../run/js/relay');

// BELOW 49152, AND THAT IS THE WHOLE REASON FOR THE NUMBER.
// presenceWire.js:41 learned this first: 65461 is inside Windows'
// ephemeral range (49152-65535), where any outbound socket this machine
// makes — or Hyper-V reserving a block at boot — can hold it first. Then
// `listen EACCES` is swallowed by `stdio: 'ignore'` and the suite can
// only report "a relay did not come up", which is true and useless.
// Observed 2026-09-20: netsh showed 65433-65532 reserved, and this suite,
// governorTwoRelays and hintWire all went red together for it.
const PORTS = [48741, 48742];

let kids = [];
function cleanup() {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  kids = [];
}
process.on('exit', cleanup);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// One relay's world: its own copy of spirit/run, its own identity, owner
// and members. Built with the same createRelay the process will use, so
// what is on disk is state a relay wrote rather than a fixture's idea of
// it.
function buildRelay(tag, memberNames) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-pw-' + tag + '-'));
  const box = createRelay(home);

  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner' + tag);
  // The first claim takes the owner invite, minted in process (cycle 3,
  // Part B; ownerClaim.js). allow.json is written by the claim itself.
  claimOwner(box, owner, 'owner' + tag, '10.0.0.1');

  const members = {};
  (memberNames || []).forEach(function (name) {
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner' + tag, name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, null, minted.invite.token, name);
    members[name] = id;
  });

  return { tag: tag, home: home, box: box, owner: owner, members: members };
}

// Copies the tree and moves the relay's state into it. Done AFTER the
// partnership is written, so the process starts already partnered — which
// is the case that matters: a relay must dial on boot, not be poked into
// it.
function plant(w) {
  const runDir = path.join(w.home, 'spirit', 'run');
  plantRun.plantRunTree(runDir);
  fs.rmSync(path.join(runDir, 'relay-state'), { recursive: true, force: true });
  fs.cpSync(path.join(w.home, 'relay-state'), path.join(runDir, 'relay-state'),
    { recursive: true });
  const mine = buildStamp.fromGit(path.join(__dirname, '..', '..'));
  if (mine) buildStamp.write(runDir, mine);
  w.runDir = runDir;
  return w;
}

// KEEP stderr, AND THAT IS THE OTHER HALF OF THE PORT LESSON.
// `stdio: 'ignore'` is how a refused port became "a relay did not come
// up" and stayed that way for an afternoon (2026-09-20). The server says
// exactly what is wrong — "Refusing to start: listen EACCES: permission
// denied" — and nobody was listening. presenceWire.js:48 wrote down that
// a test which fails for a reason it does not name is worse than no
// test, and then discarded the reason anyway. This keeps it.
async function startRelay(w, port) {
  const kid = spawn(process.execPath, ['js/server.js', '--port', String(port), '--relay'],
    { cwd: w.runDir, stdio: ['ignore', 'ignore', 'pipe'] });
  kids.push(kid);
  w.why = '';
  kid.stderr.on('data', function (b) { w.why += String(b); });
  const base = 'http://127.0.0.1:' + port;
  for (let n = 0; n < 30; n += 1) {
    await sleep(200);
    try {
      const r = await hub.relayRequest(base, 'GET', '/api/relay/key', null);
      if (r.status === 200) { w.base = base; w.kid = kid; return base; }
    } catch (e) { /* not up yet */ }
  }
  return null;
}

// A member of `w` asking its own relay something, the way a node does:
// a signed post addressed to the relay's own key, answered on the stream
// the member holds. The stream is held here with a plain fetch of the SSE
// route, which is what a node's sseClient does with more ceremony.
function askAsMember(w, member, bodyObj) {
  const relayKey = w.box.relayPublicKey();
  const text = JSON.stringify({ v: 1, body: bodyObj });
  const sig = auth.sign(member.privateKey,
    auth.postMessage(member.publicKey, relayKey, text));
  return hub.relayRequest(w.base, 'POST', '/api/relay/post',
    { from: member.publicKey, to: relayKey, text: text, sig: sig });
}

test.startTest('Partner wire — two relays, two sockets, one search');

async function run() {
  test.subHeading('Two relays that have pinned each other');

  const A = buildRelay('a', ['alice']);
  const B = buildRelay('b', ['bella', 'bertrand']);

  // RECIPROCITY IS A MEMBERSHIP: a partnership rides the row of the relay
  // owner who is a peer HERE, so each owner joins the other relay before
  // either can promote. PARTNERS.md's middle clause, made of an enrolment
  // rather than an assertion.
  [[B, 'b', A.owner, 'ownera'], [A, 'a', B.owner, 'ownerb']].forEach(function (p) {
    const minted = p[0].box.mint('owner' + p[1], p[3], 7, '');
    p[0].box.claim(p[3], auth.sign(p[2].privateKey, auth.claimMessage(p[3])),
      p[2].publicKey, null, minted.invite.token, p[3]);
  });

  const urlA = 'http://127.0.0.1:' + PORTS[0];
  const urlB = 'http://127.0.0.1:' + PORTS[1];
  const okA = A.box.setPartner(A.owner, B.owner.publicKey, urlB, B.box.relayPublicKey(), 'h1');
  const okB = B.box.setPartner(B.owner, A.owner.publicKey, urlA, A.box.relayPublicKey(), 'h2');

  if (okA.ok && okB.ok) {
    test.check('each owner promoted the other relay, pinning its key');
  } else {
    test.fail('promotion: ' + JSON.stringify(okA) + ' / ' + JSON.stringify(okB));
    test.reportSuccessFailureCount();
    return;
  }

  plant(A);
  plant(B);

  if (!(await startRelay(A, PORTS[0])) || !(await startRelay(B, PORTS[1]))) {
    test.fail('a relay did not come up on ' + PORTS.join(' / ') +
      (String(A.why || B.why || '').trim()
        ? ' — it said: ' + String(A.why || B.why).trim()
        : ' — and said nothing on stderr'));
    test.reportSuccessFailureCount();
    return;
  }
  test.check('both are answering, already partnered from the state on disk');

  // NO WAIT FOR A DIAL (R13). There used to be a pause here while each
  // relay opened its partner stream at boot. There is nothing to open:
  // the partnership is usable the moment both are answering.

  test.subHeading('A member of A finds somebody who only exists on B');

  // THE STREAM IS HELD FIRST, and that order is not incidental. A reply
  // leaves through presentNow.send, down a stream the asker already holds
  // — so a member who posts and THEN connects has already missed it. A
  // first run of this suite did exactly that and saw null: the relay
  // answered correctly into a socket nobody was on yet.
  //
  // HELD WITH sseClient, not with a raw fetch. A first draft read the
  // stream by hand — reader loop, decoder, frame splitting — and oneDoor
  // refused it, correctly: a member holding a stream is the exact thing
  // sseClient exists for, and a test that hand-rolls it is testing a
  // transport the product does not use. The guard caught it the same hour
  // it was written, which is the only reason this paragraph is short.
  let saw = null;
  const listening = sseClient.connect({
    url: A.base + '/api/relay/stream?key=' +
      encodeURIComponent(A.members.alice.publicKey),
    headers: function () {
      return {
        'X-Spirit-Sig': auth.sign(A.members.alice.privateKey,
          auth.streamMessage(A.members.alice.publicKey)),
      };
    },
    onEvent: function (msg) {
      if (msg.event !== 'reply' || !msg.data) return;
      try { saw = JSON.parse(msg.data.text).body; }
      catch (e) { /* not an envelope this test understands */ }
    },
  });
  // AND BERTRAND IS ON B, CONNECTED. Search answers the connected only
  // (Andy, 2026-09-19: "search should respond with active/online members
  // only"), so a bertrand with no stream would rightly not be found.
  const bertOnB = sseClient.connect({
    url: B.base + '/api/relay/stream?key=' +
      encodeURIComponent(B.members.bertrand.publicKey),
    headers: function () {
      return {
        'X-Spirit-Sig': auth.sign(B.members.bertrand.privateKey,
          auth.streamMessage(B.members.bertrand.publicKey)),
      };
    },
    onEvent: function () {},
  });
  await sleep(400);

  // `bertrand` is a member of B and has never been heard of by A. If A can
  // answer with him, every link in the chain worked.
  const asked = await askAsMember(A, A.members.alice, { search: { q: 'bert' } });

  if (asked.status >= 200 && asked.status < 300) {
    test.check('A accepted its member\u2019s search over a real socket');
  } else {
    test.fail('A refused the search: ' + asked.status + ' ' + asked.text);
  }

  const until = Date.now() + 6000;
  while (Date.now() < until && !saw) await sleep(100);
  listening.close();

  const labels = ((saw && saw.matches) || []).map(function (m) { return m.publicLabel; });
  if (labels.indexOf('bertrand') !== -1) {
    test.check('and bertrand came back — he is a member of B and A had never heard of him');
  } else {
    test.fail('A answered: ' + JSON.stringify(saw));
  }

  const row = ((saw && saw.matches) || []).filter(function (m) {
    return m.publicLabel === 'bertrand';
  })[0];
  if (row && row.via === B.box.relayPublicKey()) {
    test.check('carrying the partner that supplied him, which is the route a node records');
  } else {
    test.fail('via: ' + JSON.stringify(row));
  }

  // ── AND THAT B SEES HIM CONNECTED, BY FINDING HIM AT ALL ────────────
  //
  // *This corrects an earlier check*, which required a boolean `present`
  // on the row — B's answer to "is he connected", surviving the hop. Since
  // 2026-09-19 a relay answers its connected members only, so being found
  // IS the answer and the row carries no field for it (hub.handleSearch
  // marks every row it hands the browser present). Asserted as the
  // absence, so a field saying something every row says cannot creep back.
  if (row && !('present' in row) && !('owner' in row)) {
    test.check('and nothing on the row says whether he is connected — being found says it');
  } else {
    test.fail('partner row fields: ' + JSON.stringify(row));
  }
  bertOnB.close();

  test.subHeading('And A can add him, against the relay he actually lives on');

  // THE POINT OF CARRYING `via`, AND WHERE IT IS RESOLVED. A relay names
  // its partner by KEY, because a key is what it pinned and the only thing
  // it can name one by without trusting a URL somebody sent it. The NODE
  // turns that into a URL — hub.handleSearch asks its own relay
  // `{partners:true}` and maps key -> url — and confirming a peer means
  // finding him on a census, so that URL has to be B's or the confirm is
  // looked up in the wrong book.
  //
  // This suite is relay-to-relay and does not run a node, so it asserts
  // the mapping exists rather than watching hub perform it: the key the
  // row carries is one A can name a URL for.
  const mapped = (A.box.partners() || []).filter(function (p) {
    return p.relayKey === row.via;
  })[0];

  if (mapped && mapped.url === urlB) {
    test.check('and A can turn that key into a URL: ' + mapped.url);
  } else {
    test.fail('A cannot name ' + row.via + ': ' + JSON.stringify(A.box.partners()));
    cleanup();
    test.reportSuccessFailureCount();
    return;
  }
  const confirmAt = mapped.url;

  // A node acquiring, exactly as Contacts does it: peer.acquire with the
  // key and the URL the search handed over.
  const nodeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-pw-node-'));
  auth.saveIdentity(nodeHome, auth.generateIdentity('alice'));
  // ── THE SEARCH REPLY IS THE CONFIRMATION (2026-09-18) ────────────
  //
  // This fetched the far relay's census and looked for the key: "he is on
  // that census, which is what confirms him". Both halves are gone.
  //
  // The route was a public, unsigned read of every member — a cheat in
  // 0010, deleted the next day. And `peer.acquire` no longer confirms
  // anything against a relay: the key and the label both arrive in the
  // SEARCH REPLY the person clicked, so asking the relay to repeat what
  // it just said is a node spending its own request budget on nothing
  // (design/principles/THE-REQUESTER-IS-RESPONSIBLE.md).
  //
  // What the census check never did, and this makes plain: it proved
  // enrolment, not that the key belonged to the person you meant. That is
  // what `via: 'handle'` means — a human compared key endings out loud.
  //
  // So the claim here is the one that survived: the search answer carried
  // the label, by key, across a partnership.
  if (row.publicLabel === 'bertrand') {
    test.check('the search reply named him, by key — which is what acquire now records');
  } else {
    test.fail('search row: ' + JSON.stringify(row));
  }

  // THE ROUTE IS RECORDED, which is the whole of decided item 7. contactBook
  // folds `peer.relay` into the row, so the contact remembers where it
  // found him rather than having to hunt next week.
  const contactBook = require('../run/js/contacts');
  const saved = contactBook.acquire(nodeHome, {
    publicKey: row.publicKey,
    publicLabel: row.publicLabel,
    relay: confirmAt,
  }, 'handle');

  if (saved && (saved.relays || []).indexOf(confirmAt) !== -1) {
    test.check('the contact row keeps that relay as its route: ' + (saved.relays || []).join(', '));
  } else {
    test.fail('no route recorded: ' + JSON.stringify(saved));
  }

  cleanup();
  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  cleanup();
  test.fail('partnerWire threw: ' + ((e && e.stack) || e));
  test.reportSuccessFailureCount();
});
