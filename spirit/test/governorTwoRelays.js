'use strict';

// spirit/test/governorTwoRelays.js
// CYCLE 1's PROOF, PART ONE: TWO RELAYS, TWO OWNERS, CONFIRMING EACH OTHER.
//
//   Andy: "I'd prefer two relays, two owners, confirming to each other what
//   must be there." — "your end of the verification is a must."
//
// design/cycles/2026-09-19-relay-governor-cycle-1.md, R6. Two relay
// processes on loopback, each a whole copied tree with its own state. Owner
// A owns relay A and is a member of B; owner B the reverse. Nothing is
// partnered — cycle 1 stresses member connections, and a relay's RAM is
// held by the streams its members open.
//
// What a green run proves:
//
//   1. each relay read its own configuration (A: a tiny ceiling from the
//      file; B: no file, the 256 MB default)
//   2. each owner receives its OWN relay's report and no other — owner A,
//      holding a member stream on B, is never sent B's report
//   3. the rolls differ, and each report counts its own
//   4. cross-confirmation: what owner A does on B as a member — a stream,
//      posts — appears in B's report to owner B, and the reverse
//   5. posts in flight return to zero once answered
//   6. on A, with a ceiling below what the relay already uses, the
//      allowance refuses newcomers with 503, the Governor moves the lever
//      and says why, idle streams are closed, and the owner — the floor —
//      stays connected throughout
//
// Everything crosses real sockets through the interface: hub.relayRequest
// for posts, sseClient for streams. No raw http here (AGENT.md, oneDoor).

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

// Below 49152, outside Windows' ephemeral range — see partnerWire.js and
// presenceWire.js:41 for what a port inside it costs.
const PORTS = [48751, 48752];

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

// One relay's world, written by the same createRelay the process will run.
// Claims carry a distinct client key each, so the fixture is not throttled
// by the claim rate gate it is not here to test.
function buildRelay(tag, memberCount) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-gov-' + tag + '-'));
  const box = createRelay(home);
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner' + tag);
  // The first claim takes the owner invite, minted in process (cycle 3,
  // Part B; ownerClaim.js). allow.json is written by the claim itself.
  claimOwner(box, owner, 'owner' + tag, 'fixture-owner' + tag);
  const members = [];
  for (let i = 0; i < memberCount; i += 1) {
    const name = tag + 'm' + i;
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner' + tag, name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, 'fixture-' + name, minted.invite.token, name);
    members.push(id);
  }
  return { tag: tag, home: home, box: box, owner: owner, members: members };
}

function enrol(w, name, identity) {
  const minted = w.box.mint('owner' + w.tag, name, 7, '');
  return w.box.claim(name, auth.sign(identity.privateKey, auth.claimMessage(name)),
    identity.publicKey, 'fixture-x-' + name, minted.invite.token, name);
}

function plant(w, config) {
  const runDir = path.join(w.home, 'spirit', 'run');
  plantRun.plantRunTree(runDir);
  fs.rmSync(path.join(runDir, 'relay-state'), { recursive: true, force: true });
  fs.cpSync(path.join(w.home, 'relay-state'), path.join(runDir, 'relay-state'), { recursive: true });
  if (config) {
    fs.writeFileSync(path.join(runDir, 'relay-state', 'config.json'), JSON.stringify(config));
  }
  const mine = buildStamp.fromGit(path.join(__dirname, '..', '..'));
  if (mine) buildStamp.write(runDir, mine);
  w.runDir = runDir;
}

// stderr is kept, not ignored — see partnerWire.js for what discarding it
// cost. The server names its own refusal; this hands that to the failure.
async function startRelay(w, port) {
  const kid = spawn(process.execPath, ['js/server.js', '--port', String(port), '--relay'],
    { cwd: w.runDir, stdio: ['ignore', 'ignore', 'pipe'] });
  kids.push(kid);
  w.why = '';
  kid.stderr.on('data', function (b) { w.why += String(b); });
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

// Hold a stream as `identity` on relay `w`. Every event is kept; the last
// relay-status is what the owner's monitor would draw.
function hold(w, identity) {
  const seen = { events: [], lastReport: null, refused: null };
  const s = sseClient.connect({
    url: w.base + '/api/relay/stream?key=' + encodeURIComponent(identity.publicKey),
    headers: function () {
      return { 'X-Spirit-Sig': auth.sign(identity.privateKey, auth.streamMessage(identity.publicKey)) };
    },
    onEvent: function (msg) {
      seen.events.push(msg.event);
      if (msg.event === 'relay-status') seen.lastReport = msg.data;
    },
    // sseClient reports a refusal as `refused: <status>` on onClose before
    // it schedules its retry.
    onClose: function (reason) {
      const m = /^refused: (\d+)/.exec(String(reason || ''));
      if (m) seen.refused = Number(m[1]);
    },
  });
  seen.close = function () { try { s.close(); } catch (e) { /* gone */ } };
  streams.push(seen);
  return seen;
}

// A post to the relay's own key — a harmless search — so the relay meters
// it and answers it, and the answer clears it from the in-flight table.
function postToRelay(w, identity) {
  const relayKey = w.box.relayPublicKey();
  const text = JSON.stringify({ v: 1, body: { search: { q: 'nobody-here' } } });
  const sig = auth.sign(identity.privateKey, auth.postMessage(identity.publicKey, relayKey, text));
  return hub.relayRequest(w.base, 'POST', '/api/relay/post',
    { from: identity.publicKey, to: relayKey, text: text, sig: sig });
}

async function until(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await sleep(100);
  }
  return !!fn();
}

test.startTest('Governor, two relays, two owners — cycle 1 proof');

async function run() {
  test.subHeading('Two relays, each owner a member of the other');

  const A = buildRelay('a', 20);
  const B = buildRelay('b', 8);
  const aOnB = enrol(B, 'ownera', A.owner);
  const bOnA = enrol(A, 'ownerb', B.owner);
  if (aOnB.ok && bOnA.ok) {
    test.check('owner A is a member of B, owner B a member of A');
  } else {
    test.fail('cross-enrolment: ' + JSON.stringify(aOnB) + ' / ' + JSON.stringify(bOnA));
  }

  // A: a ceiling far below what any relay process already uses, so the
  // Governor must act on its first tick. B: no file, the default.
  plant(A, { ramLimitMB: 1 });
  plant(B, null);

  if (!(await startRelay(A, PORTS[0])) || !(await startRelay(B, PORTS[1]))) {
    test.fail('a relay did not come up on ' + PORTS.join(' / ') +
      (String(A.why || B.why || '').trim()
        ? ' — it said: ' + String(A.why || B.why).trim()
        : ' — and said nothing on stderr'));
    cleanup();
    test.reportSuccessFailureCount();
    return;
  }
  test.check('both relays answering');

  test.subHeading('Each owner holds its own relay’s stream, and gets its own report');

  const ownerA = hold(A, A.owner);
  const ownerB = hold(B, B.owner);
  await until(function () { return ownerA.lastReport && ownerB.lastReport; }, 5000);

  const rA = ownerA.lastReport || {};
  const rB = ownerB.lastReport || {};
  if (rA.key === A.box.relayPublicKey() && rB.key === B.box.relayPublicKey()) {
    test.check('owner A’s report is relay A’s, owner B’s is relay B’s');
  } else {
    test.fail('report keys: ' + rA.key + ' / ' + rB.key);
  }
  if (rA.ramLimitMB === 1 && rB.ramLimitMB === 256) {
    test.check('each read its configuration: A 1 MB from its file, B the 256 MB default');
  } else {
    test.fail('ramLimitMB: A ' + rA.ramLimitMB + ', B ' + rB.ramLimitMB);
  }
  // Roll: owner + members + the other owner.
  if (rA.peers === 22 && rB.peers === 10) {
    test.check('the rolls differ, and each report counts its own: A 22, B 10');
  } else {
    test.fail('peers: A ' + rA.peers + ', B ' + rB.peers);
  }

  test.subHeading('Cross-confirmation: what A does on B, B’s owner sees — and the reverse');

  const aOnBStream = hold(B, A.owner);
  const bOnAStream = hold(A, B.owner);
  await until(function () {
    return (ownerB.lastReport || {}).present === 2 && (ownerA.lastReport || {}).present >= 2;
  }, 5000);
  if ((ownerB.lastReport || {}).present === 2) {
    test.check('owner A connecting to B as a member shows on B’s report: present 2');
  } else {
    test.fail('B present: ' + (ownerB.lastReport || {}).present);
  }

  const postsBefore = (((ownerB.lastReport || {}).meter) || {}).posts || 0;
  const sent = [];
  for (let i = 0; i < 5; i += 1) sent.push(await postToRelay(B, A.owner));
  for (let i = 0; i < 3; i += 1) sent.push(await postToRelay(A, B.owner));
  if (sent.every(function (r) { return r.status >= 200 && r.status < 300; })) {
    test.check('owner A posted 5 times on B, owner B 3 times on A — all accepted');
  } else {
    test.fail('posts: ' + sent.map(function (r) { return r.status; }).join(','));
  }

  // Leaving pushes a fresh report to each owner, carrying the meter.
  aOnBStream.close();
  bOnAStream.close();
  await until(function () {
    return (((ownerB.lastReport || {}).meter) || {}).posts >= postsBefore + 5 &&
      (((ownerA.lastReport || {}).meter) || {}).posts >= 3;
  }, 5000);
  const mB = ((ownerB.lastReport || {}).meter) || {};
  const mA = ((ownerA.lastReport || {}).meter) || {};
  if (mB.posts >= postsBefore + 5 && mA.posts >= 3) {
    test.check('B’s owner sees A’s five posts in B’s meter (' + mB.posts +
      '), A’s owner sees B’s three (' + mA.posts + ')');
  } else {
    test.fail('meter posts: B ' + mB.posts + ', A ' + mA.posts);
  }

  if (aOnBStream.events.indexOf('relay-status') === -1 && bOnAStream.events.indexOf('relay-status') === -1) {
    test.check('and neither owner was sent the other relay’s report while a member there');
  } else {
    test.fail('a member stream received relay-status');
  }

  if ((ownerB.lastReport || {}).routes === 0 && (ownerA.lastReport || {}).routes === 0) {
    test.check('posts in flight back to zero once answered, on both');
  } else {
    test.fail('routes: A ' + (ownerA.lastReport || {}).routes + ', B ' + (ownerB.lastReport || {}).routes);
  }

  test.subHeading('On A, under its ceiling: the allowance, the lever, the reason');

  // A 1 MB ceiling derives an allowance of 16 streams. Twenty members try.
  const memberStreams = A.members.map(function (m) { return hold(A, m); });
  await until(function () {
    return memberStreams.filter(function (s) { return s.refused === 503; }).length > 0;
  }, 5000);
  const refused = memberStreams.filter(function (s) { return s.refused === 503; }).length;
  if (refused > 0) {
    test.check('the allowance refused ' + refused + ' newcomer(s) with 503 when full');
  } else {
    test.fail('no member was refused; allowance not enforced on the wire');
  }

  const moved = await until(function () {
    const r = ownerA.lastReport || {};
    return r.decision && r.levers && r.levers.connections1 &&
      r.levers.connections1.position !== '12/12';
  }, 15000);
  const rAfter = ownerA.lastReport || {};
  if (moved) {
    test.check('the Governor moved the lever: ' + rAfter.decision.from + ' → ' +
      rAfter.decision.to + ', allowance ' + rAfter.levers.connections1.allowed);
  } else {
    test.fail('no lever move reported: ' + JSON.stringify(rAfter.levers) + ' ' + JSON.stringify(rAfter.decision));
  }
  if (rAfter.decision && /^heap \d+% of 1 MB/.test(rAfter.decision.why)) {
    test.check('and said why: "' + rAfter.decision.why + '"');
  } else {
    test.fail('decision reason: ' + JSON.stringify(rAfter.decision));
  }
  if (rAfter.decision && typeof rAfter.decision.closed === 'number') {
    test.check('and how many idle streams it closed on that move: ' + rAfter.decision.closed);
  } else {
    test.fail('decision carries no closed count');
  }

  // The owner is the floor: still connected, still being told.
  const reportsBefore = ownerA.events.filter(function (e) { return e === 'relay-status'; }).length;
  await sleep(6000);
  const reportsAfter = ownerA.events.filter(function (e) { return e === 'relay-status'; }).length;
  if (reportsAfter > reportsBefore) {
    test.check('the owner stayed connected through the sheds and kept receiving reports');
  } else {
    test.fail('owner received no report after sheds (' + reportsBefore + ' → ' + reportsAfter + ')');
  }

  test.subHeading('B, well under its bound, holds');
  const rBend = ownerB.lastReport || {};
  if (rBend.levers && rBend.levers.connections1.position === '12/12' && !rBend.decision) {
    test.check('B’s lever at 12/12 with no decision — nothing to shed');
  } else {
    test.fail('B: ' + JSON.stringify(rBend.levers) + ' ' + JSON.stringify(rBend.decision));
  }

  cleanup();
  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  cleanup();
  test.fail('governorTwoRelays threw: ' + ((e && e.stack) || e));
  test.reportSuccessFailureCount();
});
