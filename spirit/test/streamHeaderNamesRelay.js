'use strict';

// spirit/test/streamHeaderNamesRelay.js
// goal/G16.12: a member's stream header names the relay it is for, so it cannot be replayed on another (S8 of the
// review of 2026-10-10). Written first, red on today's code, by wsl-claude; the build is the other agent's.
//
// THE HOLE: the stream signature is 'stream', the member's key and a clock minute (relayAuth.js) — it names no
// relay and carries no nonce, and a new stream evicts the old one (presence.js). So relay A, which sees the
// header of every member that connects to it, replays that header on relay B inside the ~3 minute window and
// takes over the member's stream there: B evicts the member and hands A its events.
//
// Andy argued it to this shape, 2026-10-10: "isn't the stream itself already verified though the header?" — it
// is, and the signature names no relay — then "then the header needs a signature from the relay (key)." So the
// relay's public key goes inside what the member signs, and a relay accepts a header only when the key named is
// its own.
//
// AND THE OTHER TWO REPLAY WINDOWS ARE DELIBERATELY NOT FIXED. Andy, 2026-10-11, on S5 (a sealed owner post
// replayed): "the way i see it, spirit-3 is my box. if the person i rent it from invades my space, they can do
// WAY worse that resending a dumb request. so i wouldn't fix it. same i someone has a key to my appartement, i
// just have to trust them. NOT worth fixing." And on S9 (a node's own post resent unchanged): "the other issue,
// NOT worth fixing, we gain nothing over centralized packet distribution systems." Nothing here asserts them,
// and a later session should not add them back without his word.
//
// WHAT IS ASSERTED
//   1. relayAuth.streamMessage(key, relayKey, atMs) names the relay: two relays give two messages, so one
//      signature cannot serve both; and streamSignatureOk checks the relay key it is handed.
//   2. THE REPRO, CLOSED: a header signed for relay A is refused by relay B, and the member's stream on B is
//      left alone (no eviction by a replay).
//   3. THE CONTROL: a header signed for the relay it is sent to still opens the stream.
//   4. A node signs its header for the relay it is connecting to, or the rule cannot fire: presenceNode puts
//      that relay's key into what it signs.
// rule/11: through testSupport only; in-process relays, their own temp homes, no ports and no node.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth.js');
const { createRelay } = require('../run/js/relay.js');

const OWED = 'OWED by goal/G16.12: ';
const RUN = path.join(__dirname, '..', 'run');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200); }
function sinkFor(into) {
  return { write: function (event, data) { into.push({ event: event, data: data }); }, end: function () { into.push({ event: 'end' }); } };
}

// One in-process relay with one member, the plainest box that holds a stream.
function relayWithMember(tag, member) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-streamhdr-' + tag + '-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay-' + tag));
  const owner = auth.generateIdentity('owner-' + tag);
  auth.writeOwner(home, owner.publicKey);
  const box = createRelay(home);
  box.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey);
  const minted = box.mint('owner', 'ann', 7, '');
  box.claim('ann', auth.sign(member.privateKey, auth.claimMessage('ann')), member.publicKey, null, minted.invite.token, 'ann');
  return { home: home, box: box, owner: owner, key: box.relayPublicKey() };
}

test.startTest('goal/G16.12: a stream header names the relay it is for (S8)');

// ── 1. THE MESSAGE NAMES THE RELAY ──────────────────────────────────────
test.subHeading('1. the signed stream message carries the relay\'s own key');
{
  const AT = Date.UTC(2026, 9, 11, 12, 0, 0);
  const MEMBER = 'MCowBQYDK2VwAyEAstreamHeaderMemberKeyAAAAAAAAAAAAAAA=';
  const RELAY_A = 'MCowBQYDK2VwAyEAstreamHeaderRelayAAAAAAAAAAAAAAAAAAA=';
  const RELAY_B = 'MCowBQYDK2VwAyEAstreamHeaderRelayBBBBBBBBBBBBBBBBBBB=';
  let mA = '', mB = '';
  try { mA = auth.streamMessage(MEMBER, RELAY_A, AT); mB = auth.streamMessage(MEMBER, RELAY_B, AT); }
  catch (e) { mA = 'threw ' + e.message; }
  if (mA && mB && mA !== mB && mA.indexOf(RELAY_A) !== -1) test.check('two relays give two stream messages, each naming the relay it is for');
  else test.fail(OWED + 'streamMessage(key, relayKey, at) gave ' + short(mA) + ' and ' + short(mB));

  const pair = require('crypto').generateKeyPairSync('ed25519');
  const pub = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const priv = pair.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  let forA = '', okA = false, onB = true;
  try {
    forA = auth.sign(priv, auth.streamMessage(pub, RELAY_A, AT));
    okA = auth.streamSignatureOk(pub, pub, RELAY_A, forA, AT);
    onB = auth.streamSignatureOk(pub, pub, RELAY_B, forA, AT);
  } catch (e) { okA = false; }
  // THE POSITIVE FIRST, AND THE NEGATIVE ONLY IF IT HELD. Today the relay key
  // lands where `sig` goes, so every signature is garbage and "does not verify
  // for another relay" would pass while proving nothing. A green that cannot
  // fail is worse than a red.
  if (okA === true) test.check('a header verifies for the relay it was signed for');
  else test.fail(OWED + 'streamSignatureOk(publicKey, key, relayKey, sig, at) did not verify its own relay');
  if (okA !== true) test.fail(OWED + 'and whether it refuses another relay cannot be known until it verifies its own');
  else if (onB === false) test.check('and does not verify for another relay, so one signature cannot serve two');
  else test.fail(OWED + 'a header signed for one relay still verifies for another: ' + onB);
}

// ── 2 and 3. THE REPRO AND THE CONTROL ──────────────────────────────────
test.subHeading('2. a header signed for one relay is refused by another, and the member keeps its stream');
{
  const ann = auth.generateIdentity('ann');
  const A = relayWithMember('a', ann);
  const B = relayWithMember('b', ann);

  // ann is on B, honestly: a header signed for B.
  const hersOnB = [];
  const honest = auth.sign(ann.privateKey, auth.streamMessage(ann.publicKey, B.key));
  const opened = B.box.streamOpen(ann.publicKey, honest, sinkFor(hersOnB));
  const control = !!(opened && opened.ok !== false);
  if (control) test.check('the control: a header naming the relay it is sent to opens the stream');
  else test.fail(OWED + 'an honest header was refused by its own relay: ' + short(opened));

  // EVERYTHING BELOW RESTS ON THAT CONTROL. With no stream open, "the replay
  // was refused" and "the member was not evicted" are both true of a relay
  // that simply refuses everyone, which is the vacuous green this red must not
  // report. So they are owed until the honest header works.
  if (!control) {
    test.fail(OWED + 'whether a replayed header is refused cannot be known while no honest header opens a stream');
    test.fail(OWED + 'and nor can whether the member keeps its own stream');
  } else {
    // Relay A has seen ann's header for A. It replays it on B.
    const forA = auth.sign(ann.privateKey, auth.streamMessage(ann.publicKey, A.key));
    const stolen = [];
    const replayed = B.box.streamOpen(ann.publicKey, forA, sinkFor(stolen));
    if (replayed && replayed.ok === false && replayed.status === 403) test.check('a header signed for another relay is refused 403 here');
    else test.fail(OWED + 'a replayed header opened a stream on the other relay: ' + short(replayed));

    // AND THE EVICTION IS THE DAMAGE, so it is asserted separately: a refusal
    // that still tossed the member off is the takeover with extra steps.
    if (!hersOnB.some(function (e) { return e.event === 'end'; })) test.check('and the member\'s own stream on this relay is left alone');
    else test.fail(OWED + 'the replay evicted the member from its own stream: ' + short(hersOnB));
  }
}

// ── 4. THE NODE SIGNS FOR THE RELAY IT IS CALLING ───────────────────────
test.subHeading('3. a node names the relay in the header it signs, or the rule cannot fire');
{
  const src = fs.readFileSync(path.join(RUN, 'js', 'presenceNode.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(function (l) { return l.replace(/\/\/.*$/, ''); }).join('\n');
  const at = src.indexOf('streamMessage(');
  const call = at === -1 ? '' : src.slice(at, at + 160);
  if (call && /streamMessage\(\s*[^)]*,[^)]*\)/.test(call) && !/streamMessage\(\s*identity\.publicKey\s*\)/.test(src)) {
    test.check('presenceNode signs a header for the relay it is connecting to, not for anybody\'s relay');
  } else {
    test.fail(OWED + 'presenceNode still signs a header that names no relay: ' + short(call.replace(/\s+/g, ' ')));
  }
}

test.reportSuccessFailureCount();
